"""Linear-static FEA of the NadiSense outer shell under a 50 N diametral squeeze.

Usage: python fea_squeeze.py <model_dir> <out_dir> <tol> <ang_tol> <tetgen_switches> [plot]
Mesh: TetGen tetrahedra from the CadQuery solid; solver: scikit-fem, quadratic (P2) tetrahedra,
AMG-preconditioned CG.  Units: mm, N, MPa.  Conservative case: shell alone (bonded liner ignored).
"""
import sys, json, numpy as np, pyvista as pv, tetgen, pyamg
from skfem import MeshTet, ElementVector, ElementTetP2, Basis, FacetBasis, LinearForm, asm, condense
from skfem.models.elasticity import linear_elasticity, lame_parameters
import scipy.sparse.linalg as spla

sys.path.insert(0, sys.argv[1]); OUT = sys.argv[2]
TOL, ANG, SW = float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
PLOT = len(sys.argv) > 6
from nadisense_ring import shell, R_OUT

E, NU, UTS = 2500.0, 0.35, 50.0   # assumed rigid biocompatible SLA resin (verify with resin datasheet)
FORCE = 50.0                      # N: firm grip / ring pressed against a hard edge
PATCH = 3.0                       # half-width (mm) of load and support patches

v, t = shell.val().tessellate(TOL, ANG)
pts = np.array([(p.x, p.y, p.z) for p in v]); faces = np.hstack([[3, *tri] for tri in t])
surf = pv.PolyData(pts, faces).clean()
o = tetgen.TetGen(surf).tetrahedralize(switches=SW)
nodes, elems = o[0], o[1]
m = MeshTet(nodes.T.copy(), elems.T.copy())
e = ElementVector(ElementTetP2())
ib = Basis(m, e)
lam, mu = lame_parameters(E, NU)
K = asm(linear_elasticity(lam, mu), ib)

mid = m.p[:, m.facets].mean(axis=1)
r = np.hypot(mid[0], mid[1])
bnd = np.zeros(m.facets.shape[1], bool); bnd[m.boundary_facets()] = True
outer = bnd & (r > R_OUT - 0.05)
load_f = np.nonzero(outer & (mid[1] > 0) & (np.abs(mid[0]) < PATCH))[0]
fix_f = np.nonzero(outer & (mid[1] < 0) & (np.abs(mid[0]) < PATCH))[0]


@LinearForm
def one(v_, w):
    return v_ * 0 + 1.0


area = float(asm(one, FacetBasis(m, ElementTetP2(), facets=load_f)).sum())
p = FORCE / area


@LinearForm
def traction(v_, w):
    return -p * v_[1]


f = asm(traction, FacetBasis(m, e, facets=load_f))
D = ib.get_dofs(fix_f).all()
A, b, x, I = condense(K, f, D=D)
del K
# rigid-body modes as the AMG near-null space (DOFs are interleaved x,y,z)
X = ib.doflocs[:, I]; comp = I % 3
B = np.zeros((len(I), 6))
for c in range(3):
    B[comp == c, c] = 1.0
B[comp == 0, 3] = -X[1, comp == 0]; B[comp == 1, 3] = X[0, comp == 1]
B[comp == 1, 4] = -X[2, comp == 1]; B[comp == 2, 4] = X[1, comp == 2]
B[comp == 2, 5] = -X[0, comp == 2]; B[comp == 0, 5] = X[2, comp == 0]
ml = pyamg.smoothed_aggregation_solver(A.tocsr(), B=B, symmetry="symmetric", max_coarse=500)
it = [0]
sol, info = spla.cg(A, b, M=ml.aspreconditioner(), rtol=1e-8, maxiter=1500,
                    callback=lambda xk: it.__setitem__(0, it[0] + 1))
print("cg iterations", it[0], "info", info, flush=True)
u = np.zeros(A.shape[0] + len(D)); u[I] = sol

du = ib.interpolate(u).grad
eps = 0.5 * (du + np.transpose(du, (1, 0, 2, 3)))
tr = eps[0, 0] + eps[1, 1] + eps[2, 2]
s = 2 * mu * eps; s[0, 0] += lam * tr; s[1, 1] += lam * tr; s[2, 2] += lam * tr
vm = np.sqrt(0.5 * ((s[0, 0] - s[1, 1]) ** 2 + (s[1, 1] - s[2, 2]) ** 2 + (s[2, 2] - s[0, 0]) ** 2)
             + 3 * (s[0, 1] ** 2 + s[1, 2] ** 2 + s[2, 0] ** 2))
vm_el = vm.max(axis=1)
cen = m.p[:, m.t].mean(axis=1)
near_bc = (np.hypot(cen[0], cen[1]) > R_OUT - 1.6) & (np.abs(cen[0]) < PATCH + 1.5)
peak = float(vm_el[~near_bc].max())
loc = cen[:, ~near_bc][:, np.argmax(vm_el[~near_bc])]

ux, uy, uz = (u[ib.nodal_dofs[i]] for i in range(3))
umag = np.sqrt(ux ** 2 + uy ** 2 + uz ** 2)
res = dict(switches=SW, surf_tris=int(surf.n_cells), nodes=int(m.p.shape[1]), elements=int(m.t.shape[1]),
           dofs=int(len(u)), peak_vm_MPa=round(peak, 2), peak_vm_incl_supports_MPa=round(float(vm_el.max()), 2),
           peak_location_mm=[round(float(c), 2) for c in loc], max_disp_mm=round(float(umag.max()), 4),
           FoS=round(UTS / peak, 2), load_area_mm2=round(area, 2), cg_info=int(info))
print(json.dumps(res), flush=True)
with open(f"{OUT}/fea_results.jsonl", "a") as fh:
    fh.write(json.dumps(res) + "\n")

if PLOT:
    cells = np.hstack([np.full((m.t.shape[1], 1), 4), m.t.T]).ravel()
    grid = pv.UnstructuredGrid(cells, np.full(m.t.shape[1], pv.CellType.TETRA), m.p.T)
    grid.cell_data["vm"] = vm_el
    grid.point_data["disp"] = np.c_[ux, uy, uz][: m.p.shape[1]]
    grid = grid.cell_data_to_point_data(pass_cell_data=False)
    pv.OFF_SCREEN = True
    pl = pv.Plotter(off_screen=True, window_size=(1800, 1300))
    pl.set_background("#FFFFFF")
    pl.add_mesh(grid.extract_surface(), scalars="vm", cmap="turbo", clim=[0, round(peak * 1.05, 1)],
                smooth_shading=True, show_scalar_bar=True,
                scalar_bar_args=dict(title="von Mises stress (MPa)", vertical=True, title_font_size=30,
                                     label_font_size=26, color="#0F172A", position_x=0.86, position_y=0.12,
                                     height=0.76, width=0.06, fmt="%.1f"))
    pl.add_arrows(np.array([[0, R_OUT + 8, 0]]), np.array([[0, -7, 0]]), color="#B91C1C", mag=1.0)
    pl.add_mesh(pv.Box(bounds=(-PATCH, PATCH, -R_OUT - 0.8, -R_OUT - 0.05, -4, 4)), color="#475569")
    el, az = np.radians(28), np.radians(-40)
    pl.camera.position = (100 * np.cos(el) * np.cos(az), 100 * np.cos(el) * np.sin(az), 100 * np.sin(el))
    pl.camera.focal_point = (0, 0, 0); pl.camera.up = (0, 0, 1); pl.reset_camera(); pl.camera.zoom(1.15)
    pl.screenshot(f"{OUT}/fea_stress.png"); pl.close()
    print("plot saved")

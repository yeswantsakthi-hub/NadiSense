"""Render the ring v2 flex PCB wrapped into its ring shape, with the curved Li-Po cell.

Uses the same parts as render_flex.py and wraps the strip 330 deg at r = 11.6 mm,
starting at 150 deg, exactly as in cad/nadisense_ring.py. Parts face inward,
towards the finger, as they sit in the ring.
Usage:
    python cad/render_flex_ring.py renders/flex_ring.png
"""
import sys, os
import numpy as np
import pyvista as pv

sys.argv = [sys.argv[0], "unused.png"] + sys.argv[1:]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_flex as rf  # noqa: E402

OUT = sys.argv[2] if len(sys.argv) > 2 else "flex_ring.png"


def wrap(m):
    m = m.copy()
    p = m.points
    phi = np.radians(rf.A0) + p[:, 0] / rf.R_FLEX
    r = rf.R_FLEX + rf.T - p[:, 2]          # board top faces the finger
    m.points = np.c_[r * np.cos(phi), r * np.sin(phi), -p[:, 1]]
    return m


def upright(m, mat):
    """Turn printed text 180 deg in the board plane so it reads upright on the curved inner face."""
    if mat not in (rf.LASER, rf.INK):
        return m
    m = m.copy()
    b = m.bounds
    sc, yc = (b[0] + b[1]) / 2, (b[2] + b[3]) / 2
    m.points[:, 0] = 2 * sc - m.points[:, 0]
    m.points[:, 1] = 2 * yc - m.points[:, 1]
    return m


meshes = [(wrap(upright(m, mat)).compute_normals(split_vertices=True, feature_angle=40, auto_orient_normals=False), mat)
          for m, mat in rf.items]

# curved Li-Po cell: 1.45 mm thick, 6 mm wide, 150 deg arc starting at 15 deg (ring model)
cell = pv.CylinderStructured(radius=np.linspace(10.1, 11.55, 3), height=6.0, direction=(0, 0, 1),
                             theta_resolution=12, z_resolution=2)
pts = cell.points
ang = np.degrees(np.arctan2(pts[:, 1], pts[:, 0])) % 360
cell = pv.PolyData()
th = np.radians(np.linspace(15, 165, 150))
rows = []
for r0 in (10.1, 11.55):
    for z in (-3.0, 3.0):
        rows.append(np.c_[r0 * np.cos(th), r0 * np.sin(th), np.full_like(th, z)])
n = len(th)
P = np.vstack(rows)          # 4 rails: inner-bottom, inner-top, outer-bottom, outer-top
faces = []
def quad(a, b, c, d):
    faces.extend([4, a, b, c, d])
for i in range(n - 1):
    ib, it, ob, ot = 0, n, 2 * n, 3 * n
    quad(ib + i, ib + i + 1, it + i + 1, it + i)      # inner face
    quad(ob + i, ot + i, ot + i + 1, ob + i + 1)      # outer face
    quad(it + i, it + i + 1, ot + i + 1, ot + i)      # top
    quad(ib + i, ob + i, ob + i + 1, ib + i + 1)      # bottom
for i in (0, n - 1):
    quad(i, n + i, 3 * n + i, 2 * n + i)              # end caps
battery = pv.PolyData(P, faces=np.array(faces)).triangulate().compute_normals(split_vertices=True, feature_angle=30)

pl = pv.Plotter(off_screen=True, window_size=(2000, 1600), lighting="none")
pl.set_background("#FFFFFF")
zmin = -3.2
ground = pv.Plane(center=(0, 0, -3.02), direction=(0, 0, 1), i_size=400, j_size=400)
pl.add_mesh(ground, color="#FBFBFA", ambient=0.55, diffuse=0.5, specular=0.0)
for m, (c, met, rough) in meshes:
    pl.add_mesh(m, color=c, smooth_shading=True, ambient=0.32, diffuse=0.72,
                specular=0.25 + 0.75 * met * (1 - rough), specular_power=15 + 70 * (1 - rough))
pl.add_mesh(battery, color="#B9BCC2", smooth_shading=True, ambient=0.3, diffuse=0.7, specular=0.6, specular_power=40)
for lt in (pv.Light(position=(-30, -40, 70), focal_point=(0, 0, 0), intensity=1.0, positional=True, cone_angle=60),
           pv.Light(position=(50, -30, 20), focal_point=(0, 0, 0), intensity=0.45),
           pv.Light(position=(0, 0, 0.1), focal_point=(0, -20, 0), intensity=0.35, positional=True, cone_angle=90),
           pv.Light(position=(-10, 60, 40), focal_point=(0, 0, 0), intensity=0.3)):
    pl.add_light(lt)
try:
    pl.enable_shadows()
except Exception as e:
    print("shadows off:", e)
pl.camera.position = tuple(np.array([18, 56, 40]) * 0.8)
pl.camera.focal_point = (0, 0, -1)
pl.camera.up = (0, 0, 1)
pl.camera.view_angle = 30
pl.enable_anti_aliasing("ssaa")
pl.screenshot(OUT)
print("wrote", OUT)

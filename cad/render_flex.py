"""Photo-style render of the NadiSense ring v2 flex PCB, unrolled into a gentle arch.

Board size and part positions follow cad/nadisense_ring.py: the flex wraps 330 deg
at r = 11.6 mm (about 66.8 mm long) and is 6 mm wide; each part sits at the arc
length that matches its angle in the ring model. Parts are simplified packages at
their datasheet sizes; traces and vias are illustrative, not the final layout.
Usage:
    python cad/render_flex.py renders/flex_pcb.png
"""
import sys
import numpy as np
import pyvista as pv

pv.OFF_SCREEN = True
OUT = sys.argv[1] if len(sys.argv) > 1 else "flex_pcb.png"

R_FLEX, A0, SPAN, W, T = 11.6, 150.0, 330.0, 6.0, 0.12
L = np.radians(SPAN) * R_FLEX          # ~66.8 mm


def s_at(angle):
    return np.radians((angle - A0) % 360) * R_FLEX


# materials: (colour, metallic, roughness)
POLY = ("#D8822A", 0.0, 0.45)        # polyimide + coverlay
STIFF = ("#BD6C1F", 0.0, 0.55)
COPPER = ("#F0AE57", 0.6, 0.35)      # traces seen through coverlay
GOLD = ("#E8C15A", 1.0, 0.22)        # ENIG pads
SOLDER = ("#D6D8DA", 1.0, 0.18)
MOLD = ("#141416", 0.0, 0.55)        # epoxy IC body
WLCSP = ("#1E2228", 0.3, 0.25)       # bare-die look
METAL = ("#C9CDD1", 1.0, 0.25)
CERAMIC = ("#E9E4D8", 0.0, 0.5)
CAP = ("#B8976A", 0.0, 0.6)
INK = ("#F7F7F5", 0.0, 0.7)          # white silkscreen
LASER = ("#6B6E73", 0.0, 0.8)        # laser marking on ICs

items = []


def add(mesh, mat):
    items.append((mesh.triangulate().subdivide(1, "linear") if mesh.n_cells < 400 else mesh.triangulate(), mat))


def box(s, y, ls, ly, h, mat, z0=T):
    n = max(1, int(ls / 0.4))
    m = pv.Box(bounds=(s - ls / 2, s + ls / 2, y - ly / 2, y + ly / 2, z0, z0 + h), level=(n, 1, 1))
    items.append((m.triangulate(), mat))


def disc(s, y, r, mat, z0=T, h=0.015, res=32):
    add(pv.Cylinder(center=(s, y, z0 + h / 2), direction=(0, 0, 1), radius=r, height=h, resolution=res), mat)


def text(t, s, y, hgt, mat, z0, center=True):
    m = pv.Text3D(t, depth=0.006, height=hgt).triangulate()
    b = m.bounds
    dx = s - (b[0] + b[1]) / 2 if center else s - b[0]
    m.translate((dx, y - (b[2] + b[3]) / 2, z0), inplace=True)
    items.append((m, mat))


def trace(pts, w=0.12, mat=COPPER, z0=T):
    for (a, b) in zip(pts[:-1], pts[1:]):
        (s0, y0), (s1, y1) = a, b
        if abs(s1 - s0) > abs(y1 - y0):
            box((s0 + s1) / 2, y0, abs(s1 - s0) + w, w, 0.012, mat, z0)
        else:
            box(s0, (y0 + y1) / 2, w, abs(y1 - y0) + w, 0.012, mat, z0)


def via(s, y):
    disc(s, y, 0.17, GOLD, T, 0.014, 20)
    disc(s, y, 0.07, ("#2A1A0C", 0.0, 0.9), T + 0.002, 0.014, 16)


def chip0402(s, y, mat=CAP, z0=T, rot=False):
    ls, ly = (0.5, 1.0) if rot else (1.0, 0.5)
    box(s, y, ls * 0.8 if not rot else ls, ly if not rot else ly * 0.8, 0.45, mat, z0 + 0.02)
    for d in (-1, 1):
        if rot:
            box(s, y + d * 0.44, ls + 0.04, 0.14, 0.47, SOLDER, z0 + 0.02)
            box(s, y + d * 0.52, ls + 0.12, 0.16, 0.05, SOLDER, z0)   # fillet
        else:
            box(s + d * 0.44, y, 0.14, ly + 0.04, 0.47, SOLDER, z0 + 0.02)
            box(s + d * 0.52, y, 0.16, ly + 0.12, 0.05, SOLDER, z0)


# ---- board
add(pv.Box(bounds=(0, L, -W / 2, W / 2, 0, T), level=(260, 16, 1)), POLY)
ZS = T + 0.08
for a, ls in [(212, 9.6), (270, 9.6), (316, 3.2)]:
    s0 = s_at(a) + (1.2 if a == 270 else 0)
    box(s0, 0, ls, W - 0.5, 0.08, STIFF, T)

# ---- traces (illustrative routing) and vias
for y in (-2.55, 2.55):
    trace([(0.8, y), (L - 0.8, y)], 0.16)
routes = [
    [(6.0, 0.6), (8.6, 0.6)], [(10.4, -0.8), (9.0, -0.8), (9.0, -2.55)],
    [(14.4, 0.9), (15.0, 0.9), (15.0, 2.55)], [(14.4, -0.3), (16.4, -0.3)],
    [(14.4, -1.2), (15.6, -1.2), (15.6, -2.0), (19.4, -2.0), (19.4, -1.3)],
    [(17.3, 0.5), (18.2, 0.5)], [(20.7, 0.4), (21.6, 0.4)], [(23.6, 1.1), (23.6, 1.9), (31.0, 1.9), (31.0, 1.1)],
    [(26.1, -0.2), (28.0, -0.2)], [(29.5, 0.6), (30.3, 0.6)], [(29.5, -0.7), (29.5, -1.9), (33.2, -1.9), (33.2, -0.9)],
    [(32.5, 0.4), (33.5, 0.4)], [(35.2, 0.0), (37.0, 0.0), (37.0, 1.2), (37.4, 1.2)],
    [(37.0, 0.0), (37.0, -1.2), (37.4, -1.2)], [(38.4, 1.2), (44.6, 1.2), (44.6, 1.5), (46.0, 1.5)],
    [(38.4, -1.2), (44.6, -1.2), (44.6, -1.5), (46.0, -1.5)],
]
for r in routes:
    trace(r, 0.11)
for s, y in [(9.0, -2.55), (15.0, 2.55), (19.4, -1.3), (11.2, 2.0), (13.6, -2.1), (22.4, -1.2),
             (27.3, 1.2), (31.0, 1.1), (33.2, -0.9), (36.2, 2.0), (41.0, 0.0), (5.2, -1.6), (5.2, 1.6)]:
    via(s, y)

# ---- parts
sa = s_at(186)                                             # chip antenna
box(sa, 0, 2.9, 1.6, 1.0, CERAMIC, T + 0.02)
for d in (-1, 1):
    box(sa + d * 1.5, 0, 0.32, 1.64, 1.02, METAL, T + 0.02)
    box(sa + d * 1.72, 0, 0.18, 1.8, 0.06, SOLDER, T)
text("ANT", sa, 0, 0.45, LASER, T + 1.02)

sm = s_at(212)                                             # U1 nRF52840 WLCSP
box(sm, 0, 3.5, 3.6, 0.48, WLCSP, ZS + 0.03)
text("N52840", sm, 0.5, 0.42, LASER, ZS + 0.51)
text("QIAAD0", sm, -0.3, 0.32, LASER, ZS + 0.51)

sx = s_at(230)                                             # U4 LIS2DW12 LGA
box(sx, 0, 2.0, 2.0, 0.7, MOLD, ZS + 0.02)
text("2DW", sx, 0.2, 0.36, LASER, ZS + 0.72)
disc(sx - 0.7, 0.7, 0.08, LASER, ZS + 0.72, 0.006)

sb = s_at(246)                                             # U5 BQ25120A WCSP
box(sb, 0, 2.5, 2.5, 0.5, WLCSP, ZS + 0.03)
text("BQ120A", sb, 0.1, 0.34, LASER, ZS + 0.53)
box(sb + 1.8, 0, 0.8, 1.6, 0.8, ("#4B4E54", 0.2, 0.5), ZS + 0.02)   # L1 2.2 uH (0603)
for d in (-1, 1):
    box(sb + 1.8, d * 0.74, 0.82, 0.16, 0.45, SOLDER, ZS)

sp = s_at(270) + 0.3                                       # optical cluster
for ds, lens in ((-1.9, "#D21F2B"), (1.9, "#2C2338")):     # red / IR LEDs
    box(sp + ds, 0, 1.6, 0.8, 0.55, ("#F2EFE8", 0.0, 0.35), ZS + 0.02)
    disc(sp + ds, 0, 0.3, (lens, 0.0, 0.1), ZS + 0.57, 0.05)
    for d in (-1, 1):
        box(sp + ds + d * 0.74, 0, 0.14, 0.82, 0.3, SOLDER, ZS)
box(sp, 0, 2.0, 2.0, 0.45, ("#1B2A36", 0.2, 0.12), ZS + 0.02)      # photodiode, clear package
box(sp, 0, 1.4, 1.4, 0.02, ("#3E5C70", 0.6, 0.15), ZS + 0.47)       # active area
sf = sp + 4.2
box(sf, 0, 2.8, 2.0, 0.6, MOLD, ZS + 0.02)                          # U2 MAX86141
text("86141", sf, 0.25, 0.38, LASER, ZS + 0.62)
text("MAXIM", sf, -0.4, 0.26, LASER, ZS + 0.62)

stt = s_at(296) + 1.8
box(stt, 0, 2.0, 2.0, 0.6, MOLD, ZS + 0.02)                         # U3 TMP117
text("T117", stt, 0.1, 0.36, LASER, ZS + 0.62)
disc(stt - 0.7, 0.7, 0.08, LASER, ZS + 0.62, 0.006)

sc = s_at(316)                                                      # Y1 32 MHz
box(sc, 0, 2.0, 1.6, 0.5, METAL, ZS + 0.02)
box(sc, 0, 2.08, 1.68, 0.05, ("#2B2B2B", 0.0, 0.6), ZS)
text("32.000", sc, 0, 0.3, LASER, ZS + 0.52)

for y in (-1.2, 1.2):                                               # charge-contact pads
    disc(s_at(335) + 1.4, y, 0.62, GOLD, T, 0.02, 48)
for y in (-1.5, 1.5):                                               # battery tabs
    box(46.8, y, 1.7, 1.9, 0.02, GOLD, T)

# passives around the ICs
for s, y, rot in [(9.2, 1.9, 0), (9.2, -1.9, 0), (10.8, 2.0, 0), (14.5, 1.9, 0), (14.5, -1.9, 0), (12.6, -2.1, 1),
                  (17.6, 1.6, 1), (18.2, -1.7, 0), (21.2, 1.9, 0), (21.6, -1.9, 0), (24.0, -1.9, 0),
                  (26.4, 1.6, 1), (28.4, 1.9, 0), (28.6, -1.9, 0), (30.8, -1.9, 0), (33.6, 1.9, 0),
                  (34.4, -1.9, 0), (35.6, 1.6, 1), (35.6, -1.6, 1)]:
    zz = ZS if 7.6 < s < 36.0 and (s < 17.4 or 19.5 < s < 32.0 or 33.5 < s) else T
    chip0402(s, y, CAP if int(s * 10) % 3 else ("#2F2F31", 0.0, 0.6), zz, bool(rot))

# silkscreen
text("NadiSense ring v2", 49.3, 0.55, 0.95, INK, T + 0.001, center=False)
text("Rev A   VK26-AU-FD-0015", 49.3, -1.15, 0.6, INK, T + 0.001, center=False)
text("U1", s_at(212) - 2.4, 2.25, 0.4, INK, ZS + 0.001)
text("U2", sf, 1.55, 0.4, INK, ZS + 0.001)
text("+", 46.8, 2.65, 0.45, INK, T + 0.001)
text("-", 46.8, -2.65, 0.45, INK, T + 0.001)


def bend(m, rb=80.0):
    m = m.copy()
    p = m.points
    th = (p[:, 0] - L / 2) / rb
    r = rb + p[:, 2]
    m.points = np.c_[r * np.sin(th), p[:, 1], r * np.cos(th) - rb]
    return m


if __name__ == "__main__":
    meshes = [(bend(m).compute_normals(split_vertices=True, feature_angle=40), mat) for m, mat in items]
    zmin = min(m.bounds[4] for m, _ in meshes)

    pl = pv.Plotter(off_screen=True, window_size=(2400, 1300), lighting="none")
    pl.set_background("#FFFFFF")
    ground = pv.Plane(center=(0, 0, zmin - 0.005), direction=(0, 0, 1), i_size=400, j_size=400)
    pl.add_mesh(ground, color="#FBFBFA", ambient=0.55, diffuse=0.5, specular=0.0)
    for m, (c, met, rough) in meshes:
        pl.add_mesh(m, color=c, smooth_shading=True, ambient=0.32, diffuse=0.72,
                    specular=0.25 + 0.75 * met * (1 - rough), specular_power=15 + 70 * (1 - rough))
    key = pv.Light(position=(-25, -40, 70), focal_point=(0, 0, 0), intensity=1.1, positional=True, cone_angle=50)
    fill = pv.Light(position=(60, -20, 30), focal_point=(0, 0, 0), intensity=0.45)
    rim = pv.Light(position=(0, 60, 40), focal_point=(0, 0, 0), intensity=0.35)
    for lt in (key, fill, rim):
        pl.add_light(lt)
    try:
        pl.enable_shadows()
    except Exception as e:
        print("shadows off:", e)
    pl.camera.position = (-6, -78, 50)
    pl.camera.focal_point = (0, 0, -5)
    pl.camera.up = (0, 0, 1)
    pl.camera.view_angle = 24
    pl.camera.zoom(1.0)
    pl.enable_anti_aliasing("ssaa")
    pl.screenshot(OUT)
    print("wrote", OUT, "length %.1f mm" % L)

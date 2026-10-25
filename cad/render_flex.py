"""Render the NadiSense ring v2 flex PCB unrolled into a gentle arch.

Board size and part positions follow cad/nadisense_ring.py: the flex wraps 330 deg
at r = 11.6 mm (about 66.8 mm long) and is 6 mm wide; each part sits at the arc
length that matches its angle in the ring model. Usage:
    python cad/render_flex.py renders/flex_pcb.png
"""
import sys
import numpy as np
import pyvista as pv

pv.OFF_SCREEN = True
OUT = sys.argv[1] if len(sys.argv) > 1 else "flex_pcb.png"

R_FLEX, A0, SPAN, W, T = 11.6, 150.0, 330.0, 6.0, 0.2
L = np.radians(SPAN) * R_FLEX          # ~66.8 mm


def s_at(angle):
    """Arc length along the flex for a ring angle in degrees."""
    return np.radians((angle - A0) % 360) * R_FLEX


ORANGE, STIFF = "#D9822B", "#B8661C"
GOLD, BLACK, DARK, SILVER, CERAMIC = "#E4B54A", "#1C1C1E", "#2E2E33", "#BFC3C7", "#EDEAE2"

items = []   # (mesh, colour, specular)


def box(s, y, ls, ly, h, color, z0=T, spec=0.4):
    m = pv.Box(bounds=(s - ls / 2, s + ls / 2, y - ly / 2, y + ly / 2, z0, z0 + h))
    items.append((m.triangulate().subdivide(2, "linear"), color, spec))


def disc(s, y, r, color, z0=T, h=0.03):
    m = pv.Cylinder(center=(s, y, z0 + h / 2), direction=(0, 0, 1), radius=r, height=h, resolution=40)
    items.append((m.triangulate().subdivide(1, "linear"), color, 0.6))


# board and stiffeners under the ICs
board = pv.Box(bounds=(0, L, -W / 2, W / 2, 0, T), level=(220, 12, 1)).triangulate()
items.append((board, ORANGE, 0.25))
for a, ls in [(212, 9.0), (270, 8.5), (316, 3.0)]:
    box(s_at(a), 0, ls, W - 0.6, 0.06, STIFF, spec=0.2)
Z = T + 0.06  # top of stiffener

# copper traces (gold-finished), two rails plus short links
for y in (-2.45, 2.45):
    box(L / 2, y, L - 1.0, 0.18, 0.025, GOLD, spec=0.7)
for s0, s1, y in [(9.2, 10.7, 0.0), (14.4, 15.2, 0.6), (17.3, 18.1, -0.6), (20.7, 21.3, 0.9),
                  (26.0, 26.6, 0.0), (28.7, 29.6, 0.3), (31.5, 32.6, -0.4), (34.6, 36.6, 0.0),
                  (38.3, 45.0, 0.0)]:
    box((s0 + s1) / 2, y, s1 - s0, 0.16, 0.025, GOLD, z0=T, spec=0.7)

# parts, at their ring-model angles
box(s_at(186), 0, 3.2, 1.6, 1.0, CERAMIC, Z)                 # 2.4 GHz chip antenna
box(s_at(186) - 1.45, 0, 0.3, 1.6, 1.02, SILVER, Z)
box(s_at(186) + 1.45, 0, 0.3, 1.6, 1.02, SILVER, Z)
box(s_at(212), 0, 3.5, 3.6, 0.5, BLACK, Z, 0.8)              # U1 nRF52840
box(s_at(230), 0, 2.0, 2.0, 0.7, DARK, Z)                    # U4 LIS2DW12
box(s_at(246), 0, 2.5, 2.5, 0.5, BLACK, Z, 0.8)              # U5 BQ25120A
box(s_at(246) + 2.3, 0, 2.0, 1.6, 1.0, "#5A5D63", Z)         # 2.2 uH inductor
sp = s_at(270)                                               # optical cluster
box(sp - 1.6, 0, 1.6, 0.8, 0.6, "#F4F1EA", Z)                # red LED body
disc(sp - 1.6, 0, 0.32, "#C8262B", Z + 0.6, 0.04)
box(sp + 1.6, 0, 1.6, 0.8, 0.6, "#F4F1EA", Z)                # IR LED body
disc(sp + 1.6, 0, 0.32, "#3B2A4F", Z + 0.6, 0.04)
box(sp, 0, 2.0, 2.0, 0.5, "#24323D", Z, 0.9)                 # photodiode
box(sp + 4.0, 0, 2.8, 2.0, 0.6, BLACK, Z, 0.8)               # U2 MAX86141
box(s_at(296) + 1.0, 0, 2.0, 2.0, 0.6, DARK, Z)              # U3 TMP117
box(s_at(316), 0, 2.0, 1.6, 0.5, SILVER, Z, 0.9)             # 32 MHz crystal
for y in (-1.2, 1.2):                                        # charge-contact pads
    disc(s_at(335), y, 0.6, GOLD)
for y in (-1.5, 1.5):                                        # battery tabs
    box(s_at(15) + 1.2, y, 1.6, 2.0, 0.03, GOLD, T, 0.7)

# passives (0402 caps/resistors) next to the ICs
caps = [(9.4, 1.8), (9.4, -1.8), (15.0, 1.8), (15.0, -1.8), (17.5, 1.8), (18.4, -1.8),
        (21.0, 1.8), (21.0, -1.8), (23.5, 2.0), (25.1, -2.0), (27.0, 1.9), (29.6, -1.9),
        (31.8, 1.9), (32.4, -1.9), (35.2, 1.6), (35.2, -1.6), (12.6, 2.4), (12.6, -2.4)]
for i, (s, y) in enumerate(caps):
    box(s, y, 1.0, 0.5, 0.5, "#B89B72" if i % 3 else "#3A3A3A", Z if 9 < s < 37 else T)
    box(s - 0.45, y, 0.1, 0.5, 0.52, SILVER, Z if 9 < s < 37 else T)
    box(s + 0.45, y, 0.1, 0.5, 0.52, SILVER, Z if 9 < s < 37 else T)

# silkscreen on the free section behind the battery
for text, s, y, hgt in [("NadiSense ring v2", 49.0, 0.25, 1.1), ("Rev A  VK26-AU-FD-0015", 49.0, -1.7, 0.75)]:
    t = pv.Text3D(text, depth=0.02, height=hgt).triangulate()
    t.translate((s - t.bounds[0], y - t.bounds[2], T), inplace=True)
    items.append((t, "#FFFFFF", 0.1))


def bend(m, rb=75.0):
    m = m.copy()
    p = m.points
    th = (p[:, 0] - L / 2) / rb
    r = rb + p[:, 2]
    m.points = np.c_[r * np.sin(th), p[:, 1], r * np.cos(th) - rb]
    return m


pl = pv.Plotter(off_screen=True, window_size=(2000, 1100), lighting="none")
pl.set_background("white")
pl.add_light(pv.Light(position=(20, -60, 90), focal_point=(0, 0, 0), intensity=0.85))
pl.add_light(pv.Light(position=(-70, 30, 40), focal_point=(0, 0, 0), intensity=0.35))
pl.add_light(pv.Light(light_type="headlight", intensity=0.3))
for m, c, spec in items:
    mm = bend(m).compute_normals(split_vertices=True, feature_angle=40)
    pl.add_mesh(mm, color=c, smooth_shading=True, specular=spec, specular_power=30, ambient=0.28, diffuse=0.72)
pl.camera.position = (0, -58, 62)
pl.camera.focal_point = (0, 0, -5)
pl.camera.up = (0, 0, 1)
pl.camera.zoom(1.05)
pl.enable_anti_aliasing("ssaa")
pl.screenshot(OUT)
print("wrote", OUT, "length %.1f mm" % L)

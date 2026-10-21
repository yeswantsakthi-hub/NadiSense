import sys, numpy as np, cadquery as cq, pyvista as pv
sys.path.insert(0, sys.argv[1])
from nadisense_ring import PARTS
OUT = sys.argv[2]
BG = "#F3EFE6"
pv.OFF_SCREEN = True


def mesh(shape):
    v, t = shape.tessellate(0.005, 0.08)
    pts = np.array([(p.x, p.y, p.z) for p in v])
    faces = np.hstack([[3, *tri] for tri in t])
    m = pv.PolyData(pts, faces)
    return m.compute_normals(split_vertices=True, feature_angle=35)


def shot(items, fname, elev, azim, zoom=1.0, size=(1800, 1400)):
    p = pv.Plotter(off_screen=True, window_size=size, lighting="none")
    p.set_background(BG)
    p.add_light(pv.Light(position=(40, -60, 80), focal_point=(0, 0, 0), intensity=0.9))
    p.add_light(pv.Light(position=(-60, 40, 30), focal_point=(0, 0, 0), intensity=0.35))
    p.add_light(pv.Light(light_type="headlight", intensity=0.25))
    for shape, rgb, off, opacity in items:
        m = mesh(shape).translate(off, inplace=False)
        p.add_mesh(m, color=rgb, smooth_shading=True, specular=0.35, specular_power=25,
                   ambient=0.25, diffuse=0.75, opacity=opacity)
    e, a = np.radians(elev), np.radians(azim)
    p.camera.position = (100 * np.cos(e) * np.cos(a), 100 * np.cos(e) * np.sin(a), 100 * np.sin(e))
    p.camera.focal_point = (0, 0, 0)
    p.camera.up = (0, 0, 1)
    p.reset_camera()
    p.camera.zoom(zoom)
    p.enable_anti_aliasing("ssaa")
    p.screenshot(fname)
    p.close()


shapes = [(n, wp.val(), rgb) for n, wp, rgb, _ in PARTS]
# camera: look from front-below-left so the palmar optical window is visible
shot([(s, rgb, (0, 0, 0), 1.0) for n, s, rgb in shapes], f"{OUT}/iso_assembled.png", elev=38, azim=75, zoom=1.15)

half = cq.Solid.makeBox(40, 40, 10, cq.Vector(-20, -20, 0))
shot([(s.cut(half), rgb, (0, 0, 0), 1.0) for n, s, rgb in shapes], f"{OUT}/iso_section.png", elev=55, azim=-60, zoom=1.2)

explode = {"Outer shell": (0, 0, 15), "Flex PCB": (0, 0, 6), "Li-Po cell": (0, 0, 6),
           "Inner liner": (0, 0, -14), "Optical window": (0, -5, -14), "Charge contacts": (3, 3, -22)}
shot([(s, rgb, explode.get(n, (0, 0, -3)), 1.0) for n, s, rgb in shapes],
     f"{OUT}/iso_exploded.png", elev=20, azim=-110, zoom=1.0, size=(1400, 1800))
print("ok")

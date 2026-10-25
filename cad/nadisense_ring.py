"""NadiSense ring v2 — parametric CAD model (CadQuery).

Ring axis = Z. Angle 270 deg (-Y) = palmar side of the finger, where the optics sit.
All dimensions in mm. Change the parameters below to resize the ring.
"""
import cadquery as cq

# ---------------- parameters ----------------
ID = 19.0            # inner diameter (approx. Indian ring size 19 / US 9)
WALL_LINER = 0.5     # clear inner liner thickness
R_IN = ID / 2                     # 9.5  skin surface
R_LINER = R_IN + WALL_LINER        # 10.0 liner outer / cavity inner
R_CAV = 12.0                      # cavity outer radius
R_OUT = 13.0                      # outer surface -> OD 26
WIDTH = 8.0                       # band width (axial)
SIDE = 0.5                        # shell side-wall thickness
FILLET = 0.8

PPG_ANGLE = 270
# --------------------------------------------


def band(r_in, r_out, z0, z1, a0=0, span=360):
    h = z1 - z0
    outer = cq.Solid.makeCylinder(r_out, h, cq.Vector(0, 0, z0), cq.Vector(0, 0, 1), span)
    inner = cq.Solid.makeCylinder(r_in, h, cq.Vector(0, 0, z0), cq.Vector(0, 0, 1), span)
    s = outer.cut(inner)
    return cq.Workplane().add(s).rotate((0, 0, 0), (0, 0, 1), a0)


def radial_box(angle, r_center, tangential, axial, radial):
    return (cq.Workplane("XY").box(radial, tangential, axial)
            .translate((r_center, 0, 0))
            .rotate((0, 0, 0), (0, 0, 1), angle))


def radial_pin(angle, r0, length, radius, z=0.0):
    s = cq.Solid.makeCylinder(radius, length, cq.Vector(r0, 0, z), cq.Vector(1, 0, 0))
    return cq.Workplane().add(s).rotate((0, 0, 0), (0, 0, 1), angle)


# 1. Outer shell: U-channel open towards the finger
shell = (cq.Workplane("XY").circle(R_OUT).circle(R_LINER).extrude(WIDTH)
         .translate((0, 0, -WIDTH / 2)))
shell = shell.edges(cq.selectors.RadiusNthSelector(1)).fillet(FILLET)  # round outer edges
cavity = band(R_LINER - 0.01, R_CAV, -WIDTH / 2 + SIDE, WIDTH / 2 - SIDE)
shell = shell.cut(cavity)
# 0.3 mm internal fillets at the channel corners (r = R_CAV) remove the sharp stress raisers
shell = shell.edges(cq.selectors.RadiusNthSelector(2)).fillet(0.3)

# 2. Inner liner with optical window
liner = band(R_IN, R_LINER, -WIDTH / 2, WIDTH / 2)
window = radial_box(PPG_ANGLE, (R_IN + R_LINER) / 2, 6.0, 4.0, 2.0)
liner = liner.cut(window)

# 3. Optical lens (clear epoxy) filling the window
lens = radial_box(PPG_ANGLE, (R_IN + R_LINER) / 2, 6.0, 4.0, WALL_LINER)

# 4. Flex PCB (0.2 mm), wraps 330 deg against the shell
flex = band(11.6, 11.8, -3.0, 3.0, a0=150, span=330)

# 5. Curved Li-Po cell on the dorsal side: 1.45 mm x 6 mm x 150 deg arc  (~245 mm3)
BAT_R0, BAT_R1, BAT_SPAN = 10.1, 11.55, 150
battery = band(BAT_R0, BAT_R1, -3.0, 3.0, a0=15, span=BAT_SPAN)

# 6. Optical module: MAX86141 AFE + red/IR LEDs + photodiode (5.6 x 3.3 x 1.55 envelope)
ppg = radial_box(PPG_ANGLE, 11.6 - 0.775, 5.6, 3.3, 1.55)

# 7. Temperature sensor (TMP117, 3 x 3 x 0.8 envelope)
temp = radial_box(296, 11.6 - 0.4, 3.0, 3.0, 0.8)

# 8. BLE SoC (nRF52840 WLCSP, 3.5 x 3.6 x 0.5)
mcu = radial_box(212, 11.6 - 0.25, 3.5, 3.6, 0.5)

# 9. Accelerometer (LIS2DW12, 2 x 2 x 0.7)
accel = radial_box(230, 11.6 - 0.35, 2.0, 2.0, 0.7)

# 10. Charger / power management (BQ25120A, 2.5 x 2.5 x 0.5 WCSP)
pmic = radial_box(246, 11.6 - 0.25, 2.5, 2.5, 0.5)

# 11. 32 MHz crystal (2.0 x 1.6 x 0.5) and 2.4 GHz chip antenna (3.2 x 1.6 x 1.0)
xtal = radial_box(316, 11.6 - 0.25, 2.0, 1.6, 0.5)
antenna = radial_box(186, 11.6 - 0.5, 3.2, 1.6, 1.0)

# 12. Charging contacts through the liner
pad_a = radial_pin(335, R_IN, 2.1, 0.6, z=-1.2)
pad_b = radial_pin(335, R_IN, 2.1, 0.6, z=1.2)
pads = pad_a.union(pad_b)

PARTS = [
    # name, workplane, rgb, material
    ("Outer shell", shell, (0.17, 0.25, 0.33), "Biocompatible SLA resin"),
    ("Inner liner", liner, (0.80, 0.86, 0.88), "Clear biocompatible resin"),
    ("Optical window", lens, (0.55, 0.85, 0.95), "Optically clear epoxy"),
    ("Flex PCB", flex, (0.85, 0.55, 0.12), "Polyimide 2-layer, 0.2 mm"),
    ("Li-Po cell", battery, (0.60, 0.62, 0.66), "3.7 V curved Li-Po"),
    ("PPG module", ppg, (0.10, 0.10, 0.12), "MAX86141 + LEDs + photodiode"),
    ("Temp sensor", temp, (0.25, 0.25, 0.28), "TMP117"),
    ("BLE SoC", mcu, (0.30, 0.30, 0.34), "nRF52840"),
    ("Accelerometer", accel, (0.30, 0.30, 0.34), "LIS2DW12"),
    ("Charger IC", pmic, (0.30, 0.30, 0.34), "BQ25120A"),
    ("Crystal", xtal, (0.75, 0.75, 0.78), "32 MHz crystal"),
    ("Chip antenna", antenna, (0.95, 0.95, 0.95), "2.4 GHz chip antenna"),
    ("Charge contacts", pads, (0.85, 0.70, 0.25), "Gold-plated pogo pads"),
]

if __name__ == "__main__":
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    asm = cq.Assembly(name="NadiSense_Ring_v2")
    for name, wp, rgb, _ in PARTS:
        asm.add(wp, name=name.replace(" ", "_"), color=cq.Color(*rgb))
    asm.save(f"{out}/NadiSense_Ring_v2.step")
    for name, wp, _, _ in PARTS:
        cq.exporters.export(wp, f"{out}/{name.replace(' ', '_')}.stl")
    cq.exporters.export(shell, f"{out}/Outer_shell.step")
    for name, wp, _, _ in PARTS:
        print(name, "volume mm3:", round(wp.val().Volume(), 1))

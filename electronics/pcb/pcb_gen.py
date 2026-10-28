"""NadiSense ring v2 flex PCB, Rev A layout study.

Builds a KiCad 7 board from the schematic netlist (electronics/kicad/NadiSense_ring_v2.net):
  1. writes the project footprint library NadiSense.pretty (ICs, photodiode, pads, battery tabs);
  2. creates a 66.8 x 6 mm 2-layer polyimide flex outline with flex design rules;
  3. places every part at its position along the ring (optics centred under the optical window);
  4. exports a Specctra DSN for Freerouting.
Run route step afterwards (see README in this folder).

IC land patterns are simplified: pads carry the simplified schematic pin numbers on a 0.5 mm grid
inside the real package outline. Before fabrication, replace them with the manufacturer land
patterns and give the symbols the real ball/pin map.
"""
import os, re, sys, math
import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
NET = os.path.join(HERE, "..", "kicad", "NadiSense_ring_v2.net")
LIB = os.path.join(HERE, "NadiSense.pretty")
STD = "/usr/share/kicad/footprints"
BOARD = os.path.join(HERE, "NadiSense_flex.kicad_pcb")

L, W = 66.8, 6.0          # unrolled flex: 330 deg at r = 11.6 mm, 6 mm wide
X0, Y0 = 100.0, 100.0     # board origin on the KiCad sheet (mm)

# ---------------------------------------------------------------- netlist
src = open(NET).read()
nets = {}
for name, body in re.findall(r'\(net \(code "\d+"\) \(name "([^"]*)"\)(.*?)\)\s*(?=\(net |\)\s*\)\s*$)', src, re.S):
    for ref, pin in re.findall(r'\(node \(ref "([^"]+)"\) \(pin "([^"]+)"\)', body):
        nets[(ref, pin)] = name
values = dict(re.findall(r'\(comp \(ref "([^"]+)"\)\s*\(value "([^"]*)"\)', src))


# ---------------------------------------------------------------- footprint writer
def fp_text(kind, txt, x, y, layer, size=0.5, hide=False):
    h = " hide" if hide else ""
    return (f'  (fp_text {kind} "{txt}" (at {x} {y}) (layer "{layer}"){h}\n'
            f'    (effects (font (size {size} {size}) (thickness {size * 0.15:.3f}))))\n')


def rect_lines(w, h, layer, width):
    x, y = w / 2, h / 2
    pts = [(-x, -y), (x, -y), (x, y), (-x, y), (-x, -y)]
    return "".join(f'  (fp_line (start {a[0]:.3f} {a[1]:.3f}) (end {b[0]:.3f} {b[1]:.3f}) (stroke (width {width}) (type solid)) (layer "{layer}"))\n'
                   for a, b in zip(pts[:-1], pts[1:]))


def write_fp(name, body_w, body_h, pads, descr, pin1=True, extra=""):
    s = f'(footprint "{name}" (version 20221018) (generator pcb_gen)\n  (layer "F.Cu")\n  (descr "{descr}")\n  (attr smd)\n'
    s += fp_text("reference", "REF**", 0, -body_h / 2 - 0.45, "F.SilkS", 0.4)
    s += fp_text("value", name, 0, body_h / 2 + 0.45, "F.Fab", 0.3)
    s += rect_lines(body_w, body_h, "F.Fab", 0.05)
    s += rect_lines(body_w + 0.2, body_h + 0.2, "F.CrtYd", 0.05)
    if pin1:
        s += f'  (fp_circle (center {-body_w / 2 - 0.25:.3f} {-body_h / 2:.3f}) (end {-body_w / 2 - 0.17:.3f} {-body_h / 2:.3f}) (stroke (width 0.08) (type solid)) (fill solid) (layer "F.SilkS"))\n'
    for num, x, y, shape, sx, sy in pads:
        s += (f'  (pad "{num}" smd {shape} (at {x:.3f} {y:.3f}) (size {sx} {sy}) (layers "F.Cu" "F.Paste" "F.Mask")'
              + (' (roundrect_rratio 0.25)' if shape == "roundrect" else "") + ")\n")
    s += extra + ")\n"
    open(os.path.join(LIB, name + ".kicad_mod"), "w").write(s)


os.makedirs(LIB, exist_ok=True)


def perimeter_slots(bw, bh, pitch=0.5, inset=0.3):
    """Pad slots on a 0.5 mm grid around the inside of the package outline."""
    xs = [round(v, 3) for v in frange(-(bw / 2 - inset), bw / 2 - inset, pitch)]
    ys = [round(v, 3) for v in frange(-(bh / 2 - inset), bh / 2 - inset, pitch)]
    left = [(xs[0], y) for y in ys]
    right = [(xs[-1], y) for y in ys]
    top = [(x, ys[0]) for x in xs[1:-1]]
    bottom = [(x, ys[-1]) for x in xs[1:-1]]
    return left, right, top, bottom


def frange(a, b, step):
    n = int(round((b - a) / step))
    c = (a + b) / 2 - n * step / 2
    return [c + i * step for i in range(n + 1)]


# ---------------------------------------------------------------- placement (board coordinates, mm from left end)
# Optical cluster centred at s = 24.3 mm, under the 6 x 4 mm window at ring angle 270 deg.
PLACE = {
    "AE1": (3.4, 0.0, 180), "U1": (9.6, 0.0, 0), "Y1": (13.3, 0.0, 90), "U4": (16.2, 0.0, 0),
    "U5": (18.8, 0.0, 0), "L1": (20.9, 0.0, 90),
    "D1": (22.4, 0.0, 90), "D3": (24.3, 0.0, 0), "D2": (26.15, 0.0, 90),
    "U2": (28.6, 0.0, 0), "U3": (32.0, 0.0, 0), "J1": (38.9, 0.0, 0), "BT1": (46.8, 0.0, 0),
    # passives: (x, y, rot)
    "C6": (7.0, -2.4, 0), "C2": (9.6, -2.4, 0), "C4": (11.6, -2.4, 0), "C7": (13.6, -2.4, 0),
    "C8": (13.6, 2.4, 0), "C1": (16.3, -2.4, 0), "R1": (18.2, 2.4, 0), "R2": (18.2, -2.4, 0),
    "C5": (20.3, 2.4, 0), "C11": (20.8, -2.4, 0), "C3": (27.0, -2.4, 0), "C9": (29.8, -2.4, 0),
    "C10": (32.0, -2.4, 0),
}

# Package outlines (mm) for the simplified IC land patterns
PKG = {"U1": (3.55, 3.6, "nRF52840 WLCSP 3.5 x 3.6 mm"), "U2": (2.8, 2.0, "MAX86141 WLP"),
       "U3": (2.0, 2.0, "TMP117 WSON-6 2 x 2 mm"), "U4": (2.0, 2.0, "LIS2DW12 LGA-12 2 x 2 mm"),
       "U5": (2.5, 2.5, "BQ25120A DSBGA-25 2.5 x 2.5 mm")}


def pins_of(ref):
    return sorted({p for (r, p) in nets if r == ref}, key=lambda v: int(v) if v.isdigit() else v)


def target_x(ref, pin):
    """Mean x of the other parts on this pin's net, used to face each pad towards its connection."""
    net = nets[(ref, pin)]
    xs = [PLACE[r][0] for (r, p), n in nets.items() if n == net and r != ref and r in PLACE]
    if net in ("GND", "+1V8") or not xs:
        return None
    return sum(xs) / len(xs)


def ic_footprint(ref):
    bw, bh, descr = PKG[ref]
    left, right, top, bottom = perimeter_slots(bw, bh)
    cx = PLACE[ref][0]
    pins = pins_of(ref)
    tagged = []
    for p in pins:
        t = target_x(ref, p)
        tagged.append((p, 0 if t is None else t - cx))
    # pins whose connections lie left go to the left column, right to the right, rest top/bottom
    tagged.sort(key=lambda t: t[1])
    slots_l, slots_r = list(left), list(right)
    slots_tb = [s for pair in zip(top, bottom) for s in pair] + top[len(bottom):] + bottom[len(top):]
    assign = {}
    order = sorted(tagged, key=lambda t: -abs(t[1]))
    for p, dx in order:
        if dx < -0.5 and slots_l:
            assign[p] = slots_l.pop(len(slots_l) // 2)
        elif dx > 0.5 and slots_r:
            assign[p] = slots_r.pop(len(slots_r) // 2)
        elif slots_tb:
            assign[p] = slots_tb.pop(0)
        else:
            pool = slots_l or slots_r
            assign[p] = pool.pop(0)
    pads = [(p, x, y, "circle", 0.28, 0.28) for p, (x, y) in assign.items()]
    write_fp(f"NS_{ref}_{descr.split()[0]}", bw, bh, pads, descr + " - simplified land pattern, schematic pin numbers")
    return f"NS_{ref}_{descr.split()[0]}"


FOOT = {}
for ref in PKG:
    FOOT[ref] = ("NadiSense", ic_footprint(ref))

# photodiode, 2 x 2 mm two-pad package (1 = K, 2 = A)
write_fp("NS_PD_2x2mm", 2.0, 2.0, [("1", -0.75, 0, "roundrect", 0.45, 1.6), ("2", 0.75, 0, "roundrect", 0.45, 1.6)],
         "Si PIN photodiode, 2 x 2 mm SMD")
# 32 MHz crystal, 2016 package; pins 1 and 2 are the crystal, the other two pads are case (no net)
write_fp("NS_XTAL_2016", 2.0, 1.6, [("1", -0.7, 0.55, "rect", 0.9, 0.8), ("2", 0.7, -0.55, "rect", 0.9, 0.8),
                                     ("", 0.7, 0.55, "rect", 0.9, 0.8), ("", -0.7, -0.55, "rect", 0.9, 0.8)],
         "32 MHz crystal 2.0 x 1.6 mm, 4-pad")
# charging contacts for the pogo pins through the liner (1 = GND, 2 = VIN)
write_fp("NS_ChargePads_2x1.2mm", 1.6, 4.0, [("1", 0, -1.2, "circle", 1.2, 1.2), ("2", 0, 1.2, "circle", 1.2, 1.2)],
         "Gold (ENIG) contact pads for the charging pogo pins", pin1=False)
# curved Li-Po tabs (1 = +, 2 = -)
write_fp("NS_LiPo_Tabs", 1.8, 5.0, [("1", 0, -1.5, "rect", 1.6, 1.9), ("2", 0, 1.5, "rect", 1.6, 1.9)],
         "Solder tabs for the 12 mAh curved Li-Po cell", pin1=False)

FOOT.update({
    "D3": ("NadiSense", "NS_PD_2x2mm"), "Y1": ("NadiSense", "NS_XTAL_2016"),
    "J1": ("NadiSense", "NS_ChargePads_2x1.2mm"), "BT1": ("NadiSense", "NS_LiPo_Tabs"),
    "AE1": ("RF_Antenna", "Johanson_2450AT18x100"),
    "D1": ("LED_SMD", "LED_0603_1608Metric"), "D2": ("LED_SMD", "LED_0603_1608Metric"),
    "L1": ("Inductor_SMD", "L_0603_1608Metric"),
})
for r in values:
    if r[0] in "CR" and r not in FOOT:
        FOOT[r] = ("Capacitor_SMD" if r[0] == "C" else "Resistor_SMD",
                   "C_0402_1005Metric" if r[0] == "C" else "R_0402_1005Metric")


def libpath(lib):
    return LIB if lib == "NadiSense" else os.path.join(STD, lib + ".pretty")


# ---------------------------------------------------------------- board
mm = pcbnew.FromMM
board = pcbnew.BOARD()
board.SetCopperLayerCount(2)
ds = board.GetDesignSettings()
ds.m_TrackMinWidth = mm(0.075)
ds.m_MinClearance = mm(0.075)
ds.m_ViasMinSize = mm(0.35)
ds.m_MinThroughDrill = mm(0.15)
ds.m_ViasMinAnnularWidth = mm(0.075)
ds.m_CopperEdgeClearance = mm(0.15)
ds.m_HoleToHoleMin = mm(0.25)
ds.m_HoleClearance = mm(0.15)
nc = ds.m_NetSettings.m_DefaultNetClass
nc.SetClearance(mm(0.1)); nc.SetTrackWidth(mm(0.1)); nc.SetViaDiameter(mm(0.4)); nc.SetViaDrill(mm(0.2))
ds.SetBoardThickness(mm(0.11))
ds.m_MinSilkTextHeight = mm(0.5)

# outline with 0.5 mm corner radii
def seg(a, b, layer=pcbnew.Edge_Cuts):
    s = pcbnew.PCB_SHAPE(board); s.SetShape(pcbnew.SHAPE_T_SEGMENT)
    s.SetStart(pcbnew.VECTOR2I(mm(a[0]), mm(a[1]))); s.SetEnd(pcbnew.VECTOR2I(mm(b[0]), mm(b[1])))
    s.SetLayer(layer); s.SetWidth(mm(0.05)); board.Add(s)

def arc(c, start, angle):
    s = pcbnew.PCB_SHAPE(board); s.SetShape(pcbnew.SHAPE_T_ARC)
    s.SetCenter(pcbnew.VECTOR2I(mm(c[0]), mm(c[1]))); s.SetStart(pcbnew.VECTOR2I(mm(start[0]), mm(start[1])))
    s.SetArcAngleAndEnd(pcbnew.EDA_ANGLE(angle, pcbnew.DEGREES_T))
    s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(mm(0.05)); board.Add(s)

r = 0.5
x1, y1, x2, y2 = X0, Y0 - W / 2, X0 + L, Y0 + W / 2
seg((x1 + r, y1), (x2 - r, y1)); seg((x2, y1 + r), (x2, y2 - r))
seg((x2 - r, y2), (x1 + r, y2)); seg((x1, y2 - r), (x1, y1 + r))
arc((x2 - r, y1 + r), (x2 - r, y1), 90); arc((x2 - r, y2 - r), (x2, y2 - r), 90)
arc((x1 + r, y2 - r), (x1 + r, y2), 90); arc((x1 + r, y1 + r), (x1, y1 + r), 90)

netinfo = {}
for n in sorted(set(nets.values())):
    if n.startswith("unconnected-"):
        continue
    ni = pcbnew.NETINFO_ITEM(board, n); board.Add(ni); netinfo[n] = ni

for ref, (lib, name) in FOOT.items():
    fp = pcbnew.FootprintLoad(libpath(lib), name)
    if fp is None:
        sys.exit(f"missing footprint {lib}:{name}")
    fp.SetReference(ref); fp.SetValue(values.get(ref, ""))
    x, y, rot = PLACE[ref]
    fp.SetPosition(pcbnew.VECTOR2I(mm(X0 + x), mm(Y0 + y)))
    fp.SetOrientationDegrees(rot)
    fp.Reference().SetTextSize(pcbnew.VECTOR2I(mm(0.4), mm(0.4))); fp.Reference().SetTextThickness(mm(0.06))
    fp.Reference().SetVisible(False)
    fp.Value().SetTextSize(pcbnew.VECTOR2I(mm(0.25), mm(0.25))); fp.Value().SetTextThickness(mm(0.04))
    fp.Value().SetLayer(pcbnew.F_Fab)   # too small for silkscreen on a 6 mm strip; kept on the assembly drawing
    fp.SetFPID(pcbnew.LIB_ID(lib, name))
    for item in fp.GraphicalItems():               # no component silkscreen on the 6 mm flex: move it to Fab
        if item.GetLayer() == pcbnew.F_SilkS and item.GetClass() != "FP_TEXT":
            item.SetLayer(pcbnew.F_Fab)
    board.Add(fp)
    for pad in fp.Pads():
        n = nets.get((ref, pad.GetNumber()))
        if n and n in netinfo:
            pad.SetNet(netinfo[n])

# antenna: no copper pour under or beyond the chip antenna (tracks allowed for the feed)
ko = pcbnew.ZONE(board)
ko.SetIsRuleArea(True); ko.SetDoNotAllowCopperPour(True); ko.SetDoNotAllowVias(True)
ko.SetDoNotAllowTracks(False); ko.SetDoNotAllowPads(False); ko.SetDoNotAllowFootprints(False)
ls = pcbnew.LSET(); ls.AddLayer(pcbnew.F_Cu); ls.AddLayer(pcbnew.B_Cu); ko.SetLayerSet(ls)
o = ko.Outline(); o.NewOutline()
for px, py in [(0.0, -3.0), (5.4, -3.0), (5.4, 3.0), (0.0, 3.0)]:
    o.Append(mm(X0 + px), mm(Y0 + py))
ko.SetZoneName("ANTENNA_KEEPOUT"); board.Add(ko)

# 0.15 mm routing keep-out along the long edges so the autorouter respects the flex edge clearance
for ya, yb in ((-W / 2, -W / 2 + 0.15), (W / 2 - 0.15, W / 2)):
    e = pcbnew.ZONE(board)
    e.SetIsRuleArea(True); e.SetDoNotAllowTracks(True); e.SetDoNotAllowVias(True)
    e.SetDoNotAllowCopperPour(False); e.SetDoNotAllowPads(False); e.SetDoNotAllowFootprints(False)
    ls2 = pcbnew.LSET(); ls2.AddLayer(pcbnew.F_Cu); ls2.AddLayer(pcbnew.B_Cu); e.SetLayerSet(ls2)
    o = e.Outline(); o.NewOutline()
    for px, py in [(0.0, ya), (L, ya), (L, yb), (0.0, yb)]:
        o.Append(mm(X0 + px), mm(Y0 + py))
    e.SetZoneName("EDGE_KEEPOUT"); board.Add(e)

# silkscreen on the free section behind the battery
for txt, x, y, h in [("NadiSense ring v2  Rev A", 49.2, -0.7, 0.8), ("VK26-AU-FD-0015 . Team Ring of Care", 49.2, 0.9, 0.5)]:
    t = pcbnew.PCB_TEXT(board); t.SetText(txt); t.SetLayer(pcbnew.F_SilkS)
    t.SetPosition(pcbnew.VECTOR2I(mm(X0 + x), mm(Y0 + y))); t.SetTextSize(pcbnew.VECTOR2I(mm(h), mm(h)))
    t.SetTextThickness(mm(max(0.08, h * 0.15))); t.SetHorizJustify(pcbnew.GR_TEXT_H_ALIGN_LEFT); board.Add(t)
for txt, x, y in [("+", 46.8, -2.75), ("-", 46.8, 2.75)]:
    t = pcbnew.PCB_TEXT(board); t.SetText(txt); t.SetLayer(pcbnew.F_SilkS)
    t.SetPosition(pcbnew.VECTOR2I(mm(X0 + x - 1.3), mm(Y0 + y + (0.9 if txt == "+" else -0.9))))
    t.SetTextSize(pcbnew.VECTOR2I(mm(0.6), mm(0.6))); t.SetTextThickness(mm(0.1)); board.Add(t)

# fab notes on User.Comments
notes = ["2-layer polyimide flex, 25 um PI core, 1/3 oz Cu, 25 um coverlay both sides, ENIG",
         "Total thickness ~0.11 mm; FR4 or PI stiffeners 0.1 mm under U1-U5 (see User.1)",
         "Min track/space 75/75 um; vias 0.4/0.2 mm; bend only between stiffeners, min radius 10 mm",
         "IC land patterns simplified - replace with manufacturer patterns before fabrication"]
for i, n in enumerate(notes):
    t = pcbnew.PCB_TEXT(board); t.SetText(n); t.SetLayer(pcbnew.Cmts_User)
    t.SetPosition(pcbnew.VECTOR2I(mm(X0), mm(Y0 + 5.5 + i * 1.2))); t.SetTextSize(pcbnew.VECTOR2I(mm(0.8), mm(0.8)))
    t.SetTextThickness(mm(0.12)); t.SetHorizJustify(pcbnew.GR_TEXT_H_ALIGN_LEFT); board.Add(t)

# stiffener outlines on User.1
for xa, xb in [(5.2, 17.6), (18.0, 33.4)]:
    for a, b in [((xa, -2.9), (xb, -2.9)), ((xb, -2.9), (xb, 2.9)), ((xb, 2.9), (xa, 2.9)), ((xa, 2.9), (xa, -2.9))]:
        seg((X0 + a[0], Y0 + a[1]), (X0 + b[0], Y0 + b[1]), pcbnew.User_1)

board.Save(BOARD)
libs = sorted({lib for lib, _ in FOOT.values()})
with open(os.path.join(HERE, "fp-lib-table"), "w") as f:
    f.write("(fp_lib_table\n  (version 7)\n")
    for lib in libs:
        uri = "${KIPRJMOD}/NadiSense.pretty" if lib == "NadiSense" else "${KICAD7_FOOTPRINT_DIR}/%s.pretty" % lib
        f.write(f'  (lib (name "{lib}")(type "KiCad")(uri "{uri}")(options "")(descr ""))\n')
    f.write(")\n")
pcbnew.ExportSpecctraDSN(board, BOARD.replace(".kicad_pcb", ".dsn"))
print("placed", len(FOOT), "parts;", len(netinfo), "nets ->", BOARD)

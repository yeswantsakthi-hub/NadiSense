"""NadiSense ring v2 Rev B flex PCB: footprints, outline, rules, placement, BGA fan-out, Specctra DSN.

Reads the netlist exported from the Rev B schematic (NadiSense_ring_v2_revB.net).
Then: Freerouting -> route_import.py -> drc.py   (see run_all.sh)
"""
import os, re, sys
import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
NET = os.path.join(HERE, "NadiSense_ring_v2_revB.net")
LIB = os.path.join(HERE, "NadiSense.pretty")
STD = "/usr/share/kicad/footprints"
BOARD = os.path.join(HERE, "NadiSense_ring_v2_revB.kicad_pcb")
mm = pcbnew.FromMM

L, W = 66.8, 6.0            # flex strip: 330 deg at r = 11.6 mm, 6 mm wide
X0, Y0 = 100.0, 100.0
# battery cell covers strip positions < 3.0 mm and > 45.5 mm on the finger side; optics centred at 24.3 mm

# ---------------------------------------------------------------- netlist
src = open(NET).read()
pin_net = {}
for name, body in re.findall(r'\(net \(code "\d+"\) \(name "([^"]*)"\)(.*?)\)\s*(?=\(net |\)\s*\)\s*$)', src, re.S):
    for ref, pin in re.findall(r'\(node \(ref "([^"]+)"\) \(pin "([^"]+)"\)', body):
        pin_net[(ref, pin)] = name
comps = {}
for ref, val, fp in re.findall(r'\(comp \(ref "([^"]+)"\)\s*\(value "([^"]*)"\)\s*\(footprint "([^"]*)"\)', src):
    comps[ref] = (val, fp)


# ---------------------------------------------------------------- project footprints
def kmod(name, descr, body, pads, extra="", attr="smd"):
    bw, bh = body
    cw, ch = bw / 2 + 0.1, bh / 2 + 0.1
    s = [f'(footprint "{name}" (version 20221018) (generator pcbnew)', '  (layer "F.Cu")', f'  (descr "{descr}")',
         f'  (attr {attr})',
         f'  (fp_text reference "REF**" (at 0 {-bh / 2 - 0.5:.3f}) (layer "F.SilkS") (effects (font (size 0.5 0.5) (thickness 0.08))))',
         f'  (fp_text value "{name}" (at 0 {bh / 2 + 0.5:.3f}) (layer "F.Fab") (effects (font (size 0.3 0.3) (thickness 0.05))))',
         f'  (fp_text user "${{REFERENCE}}" (at 0 0) (layer "F.Fab") (effects (font (size 0.3 0.3) (thickness 0.05))))']
    for lay, (hx, hy), wd in (("F.Fab", (bw / 2, bh / 2), 0.05), ("F.CrtYd", (cw, ch), 0.05)):
        pts = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy), (-hx, -hy)]
        for a, b in zip(pts, pts[1:]):
            s.append(f'  (fp_line (start {a[0]:.3f} {a[1]:.3f}) (end {b[0]:.3f} {b[1]:.3f}) (stroke (width {wd}) (type solid)) (layer "{lay}"))')
    # pin-1 chamfer mark on Fab
    s.append(f'  (fp_line (start {-bw / 2:.3f} {-bh / 2 + 0.3:.3f}) (end {-bw / 2 + 0.3:.3f} {-bh / 2:.3f}) (stroke (width 0.05) (type solid)) (layer "F.Fab"))')
    for p in pads:
        s.append("  " + p)
    s.append(extra + ")")
    open(os.path.join(LIB, name + ".kicad_mod"), "w").write("\n".join(s) + "\n")


def ball(num, x, y, d, mask=0.04):
    return (f'(pad "{num}" smd circle (at {x:.4f} {y:.4f}) (size {d} {d}) (layers "F.Cu" "F.Paste" "F.Mask") '
            f'(solder_mask_margin {mask}))')


def grid(rows, ncols, pitch, d, present=None):
    out = []
    nr = len(rows)
    for i, r in enumerate(rows):
        for c in range(1, ncols + 1):
            num = f"{r}{c}"
            if present and num not in present:
                continue
            x = (c - (ncols + 1) / 2) * pitch
            y = (i - (nr - 1) / 2) * pitch
            out.append(ball(num, x, y, d))
    return out


os.makedirs(LIB, exist_ok=True)
sys.path.insert(0, HERE)
import design as D
kmod("Nordic_WLCSP-94_3.544x3.607mm_P0.35mm",
     "nRF52840-CKAA WLCSP-94, 10x10 grid (A-K, 1-10), 0.35 mm pitch, 0.19 mm NSMD pads, top view, ball A1 top-left. "
     "Verify against Nordic PS section 7.2.3 before fabrication.",
     (3.544, 3.607), grid("ABCDEFGHJK", 10, 0.35, 0.19, set(D.NRF_BALLS)))
kmod("Maxim_WLP-20_2.048x1.848mm_Layout5x4_P0.4mm",
     "MAX86141 WLP-20 (5x4), 0.4 mm pitch, 0.25 mm NSMD pads, top view, A1 top-left. Verify against ADI outline 21-100134 / AN1891.",
     (2.048, 1.848), grid("ABCD", 5, 0.4, 0.25))
kmod("TI_DSBGA-25_2.5x2.5mm_Layout5x5_P0.5mm",
     "BQ25120A YFP DSBGA-25 (5x5), 0.5 mm pitch, 0.25 mm NSMD pads, top view, A1 top-left.",
     (2.5, 2.5), grid("ABCDE", 5, 0.5, 0.25))
kmod("PD_2x2mm", "Si PIN photodiode, 2 x 2 mm SMD, 1 = K, 2 = A", (2.0, 2.0),
     ['(pad "1" smd roundrect (at -0.75 0) (size 0.45 1.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25))',
      '(pad "2" smd roundrect (at 0.75 0) (size 0.45 1.6) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25))'])
kmod("TestPad_D0.8mm", "0.8 mm ENIG test pad for the programming / test jig", (0.9, 0.9),
     ['(pad "1" smd circle (at 0 0) (size 0.8 0.8) (layers "F.Cu" "F.Mask"))'])
kmod("ChargePads_2xD1.2mm", "ENIG contact pads for the charging pogo pins (1 = GND, 2 = VIN)", (1.6, 4.0),
     ['(pad "1" smd circle (at 0 -1.2) (size 1.2 1.2) (layers "F.Cu" "F.Mask"))',
      '(pad "2" smd circle (at 0 1.2) (size 1.2 1.2) (layers "F.Cu" "F.Mask"))'])
kmod("LiPo_Tabs_1.6x1.9mm", "Solder tabs for the 12 mAh curved Li-Po (1 = +, 2 = -)", (1.8, 5.0),
     ['(pad "1" smd rect (at 0 -1.5) (size 1.6 1.9) (layers "F.Cu" "F.Mask"))',
      '(pad "2" smd rect (at 0 1.5) (size 1.6 1.9) (layers "F.Cu" "F.Mask"))'])

# ---------------------------------------------------------------- placement: ref -> (x, y, rotation, side)
P = {
    "AE1": (4.9, 0.0, 180, "F"), "C9": (7.5, 2.25, 0, "F"), "L2": (8.6, 0.9, 0, "F"), "C8": (9.2, 2.3, 0, "F"),
    "Y1": (8.6, -1.75, 0, "F"), "C6": (10.9, -2.45, 0, "F"), "C7": (12.4, -2.45, 0, "F"),
    "U1": (11.9, 0.0, 0, "F"),
    "C1": (13.85, -2.45, 0, "F"), "C2": (15.5, -2.4, 0, "F"), "C3": (10.6, 2.45, 0, "F"),
    "C4": (12.6, 2.4, 0, "F"), "C5": (14.25, 2.45, 0, "F"),
    "U4": (19.9, 0.0, 0, "F"), "C16": (19.2, -2.45, 0, "F"), "C17": (20.7, -2.45, 0, "F"),
    "R1": (19.2, 2.45, 0, "F"), "R2": (20.7, 2.45, 0, "F"),
    "D1": (22.4, 0.0, 90, "F"), "D3": (24.3, 0.0, 0, "F"), "D2": (26.15, 0.0, 90, "F"),
    "U2": (28.6, 0.0, 0, "F"), "C14": (27.9, -2.4, 0, "F"), "C10": (29.6, -2.45, 0, "F"),
    "C11": (27.9, 2.4, 0, "F"), "C12": (29.6, 2.45, 0, "F"), "C13": (30.3, -1.2, 90, "F"),
    "U3": (32.0, 0.0, 0, "F"), "C15": (32.0, -2.45, 0, "F"), "R3": (32.0, 2.45, 0, "F"),
    "U5": (36.3, 0.0, 0, "F"), "C18": (35.7, -2.4, 0, "F"), "C19": (37.6, -2.4, 0, "F"),
    "L1": (39.35, -1.0, 90, "F"), "C20": (39.5, 1.6, 0, "F"), "C22": (38.1, 0.4, 90, "F"), "C23": (38.1, -1.1, 90, "F"),
    "C21": (34.1, -0.6, 90, "F"), "R4": (34.55, 2.45, 0, "F"), "R5": (36.0, 2.45, 0, "F"), "R6": (37.45, 2.45, 0, "F"),
    "J1": (42.6, 0.0, 0, "F"), "BT1": (46.8, 0.0, 0, "F"),
    # programming pads on the bottom, beside the SoC (stiffener cut-out): SWD, reset, 1.8 V, GND; MR by the charger
    "TP1": (9.2, 1.4, 0, "B"), "TP2": (9.2, 0.0, 0, "B"), "TP3": (8.0, 1.4, 0, "B"), "TP4": (8.0, 0.0, 0, "B"),
    "TP5": (8.0, -1.4, 0, "B"), "TP6": (41.0, 1.5, 0, "B"),
}
missing = set(comps) - set(P)
assert not missing, missing


def libpath(lib):
    return LIB if lib == "NadiSense" else os.path.join(STD, lib + ".pretty")


# ---------------------------------------------------------------- board + rules
board = pcbnew.BOARD()
board.SetCopperLayerCount(2)
ds = board.GetDesignSettings()
ds.m_TrackMinWidth = mm(0.075); ds.m_MinClearance = mm(0.075)
ds.m_ViasMinSize = mm(0.2); ds.m_MinThroughDrill = mm(0.1); ds.m_ViasMinAnnularWidth = mm(0.05)
ds.m_CopperEdgeClearance = mm(0.15); ds.m_HoleToHoleMin = mm(0.2); ds.m_HoleClearance = mm(0.1)
ds.m_MinSilkTextHeight = mm(0.45); ds.m_SilkClearance = mm(0.0)
ds.SetBoardThickness(mm(0.11))
ns = ds.m_NetSettings
dc = ns.m_DefaultNetClass
dc.SetClearance(mm(0.075)); dc.SetTrackWidth(mm(0.1)); dc.SetViaDiameter(mm(0.35)); dc.SetViaDrill(mm(0.15))


def seg(a, b, layer=pcbnew.Edge_Cuts, w=0.05):
    s = pcbnew.PCB_SHAPE(board); s.SetShape(pcbnew.SHAPE_T_SEGMENT)
    s.SetStart(pcbnew.VECTOR2I(mm(a[0]), mm(a[1]))); s.SetEnd(pcbnew.VECTOR2I(mm(b[0]), mm(b[1])))
    s.SetLayer(layer); s.SetWidth(mm(w)); board.Add(s)


def arc(c, start, angle):
    s = pcbnew.PCB_SHAPE(board); s.SetShape(pcbnew.SHAPE_T_ARC)
    s.SetCenter(pcbnew.VECTOR2I(mm(c[0]), mm(c[1]))); s.SetStart(pcbnew.VECTOR2I(mm(start[0]), mm(start[1])))
    s.SetArcAngleAndEnd(pcbnew.EDA_ANGLE(angle, pcbnew.DEGREES_T)); s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(mm(0.05))
    board.Add(s)


r = 0.5
x1, y1, x2, y2 = X0, Y0 - W / 2, X0 + L, Y0 + W / 2
seg((x1 + r, y1), (x2 - r, y1)); seg((x2, y1 + r), (x2, y2 - r)); seg((x2 - r, y2), (x1 + r, y2)); seg((x1, y2 - r), (x1, y1 + r))
arc((x2 - r, y1 + r), (x2 - r, y1), 90); arc((x2 - r, y2 - r), (x2, y2 - r), 90)
arc((x1 + r, y2 - r), (x1 + r, y2), 90); arc((x1 + r, y1 + r), (x1, y1 + r), 90)

nets = {}
for n in sorted(set(pin_net.values())):
    if n.startswith("unconnected-"):
        continue
    ni = pcbnew.NETINFO_ITEM(board, n); board.Add(ni); nets[n] = ni

fps = {}
for ref, (val, fpid) in comps.items():
    lib, name = fpid.split(":")
    fp = pcbnew.FootprintLoad(libpath(lib), name)
    assert fp is not None, fpid
    fp.SetFPID(pcbnew.LIB_ID(lib, name)); fp.SetReference(ref); fp.SetValue(val)
    x, y, rot, side = P[ref]
    fp.SetPosition(pcbnew.VECTOR2I(mm(X0 + x), mm(Y0 + y)))
    board.Add(fp)
    if side == "B":
        fp.Flip(fp.GetPosition(), False)
    fp.SetOrientationDegrees(rot)
    # component silkscreen is not printed on the 6 mm strip (coverlay); keep it on Fab for the assembly drawing
    for item in fp.GraphicalItems():
        if item.GetLayer() in (pcbnew.F_SilkS, pcbnew.B_SilkS) and item.GetClass() != "FP_TEXT":
            item.SetLayer(pcbnew.F_Fab if side == "F" else pcbnew.B_Fab)
    fp.Reference().SetVisible(False)
    fp.Value().SetVisible(False)
    for pad in fp.Pads():
        n = pin_net.get((ref, pad.GetNumber()))
        if n in nets:
            pad.SetNet(nets[n])
    if ref in D.DNP:
        fp.SetAttributes(fp.GetAttributes() | pcbnew.FP_EXCLUDE_FROM_BOM | pcbnew.FP_EXCLUDE_FROM_POS_FILES)
    fps[ref] = fp

# ---------------------------------------------------------------- via-in-pad fan-out for the chip-scale packages
# 0.2/0.1 mm laser vias, filled and capped (VIPPO), in every connected ball: escapes go to the bottom layer.
nfan = 0
for ref in ("U1", "U2", "U5"):
    fp = fps[ref]
    xs = sorted({round(pcbnew.ToMM(p.GetPosition().x), 3) for p in fp.Pads()})
    ys = sorted({round(pcbnew.ToMM(p.GetPosition().y), 3) for p in fp.Pads()})
    for pad in fp.Pads():
        n = pad.GetNetname()
        if not n:
            continue
        px, py = round(pcbnew.ToMM(pad.GetPosition().x), 3), round(pcbnew.ToMM(pad.GetPosition().y), 3)
        v = pcbnew.PCB_VIA(board)
        v.SetPosition(pad.GetPosition()); v.SetWidth(mm(0.2)); v.SetDrill(mm(0.1))
        v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu); v.SetNet(pad.GetNet()); v.SetLocked(True)
        board.Add(v); nfan += 1

# ---------------------------------------------------------------- rule areas
def area(name, pts, layers, tracks=False, vias=False, pour=False):
    z = pcbnew.ZONE(board); z.SetIsRuleArea(True); z.SetZoneName(name)
    z.SetDoNotAllowTracks(tracks); z.SetDoNotAllowVias(vias); z.SetDoNotAllowCopperPour(pour)
    z.SetDoNotAllowPads(False); z.SetDoNotAllowFootprints(False)
    ls = pcbnew.LSET()
    for l in layers:
        ls.AddLayer(l)
    z.SetLayerSet(ls)
    o = z.Outline(); o.NewOutline()
    for px, py in pts:
        o.Append(mm(X0 + px), mm(Y0 + py))
    board.Add(z)


area("ANTENNA_KEEPOUT", [(0, -3), (7.05, -3), (7.05, 1.6), (7.05, 3), (0, 3)], (pcbnew.F_Cu, pcbnew.B_Cu), pour=True, vias=True)
for ya, yb in ((-W / 2, -W / 2 + 0.15), (W / 2 - 0.15, W / 2)):
    area("EDGE_KEEPOUT", [(0, ya), (L, ya), (L, yb), (0, yb)], (pcbnew.F_Cu, pcbnew.B_Cu), tracks=True, vias=True)
# keep routing out from under the optical window: only the LED / photodiode pads live there
area("OPTICAL_WINDOW", [(21.3, -2.0), (27.3, -2.0), (27.3, 2.0), (21.3, 2.0)], (pcbnew.F_Cu,), vias=True)

# ---------------------------------------------------------------- stiffeners, text, notes
for xa, xb in [(9.9, 21.3), (21.5, 40.4)]:
    pts = [(xa, -2.9), (xb, -2.9), (xb, 2.9), (xa, 2.9), (xa, -2.9)]
    for a, b in zip(pts, pts[1:]):
        seg((X0 + a[0], Y0 + a[1]), (X0 + b[0], Y0 + b[1]), pcbnew.User_1, 0.1)


def text(txt, x, y, h, layer=pcbnew.F_SilkS, left=True, mirror=False):
    t = pcbnew.PCB_TEXT(board); t.SetText(txt); t.SetLayer(layer)
    t.SetPosition(pcbnew.VECTOR2I(mm(X0 + x), mm(Y0 + y))); t.SetTextSize(pcbnew.VECTOR2I(mm(h), mm(h)))
    t.SetTextThickness(mm(max(0.08, h * 0.15)))
    if left:
        t.SetHorizJustify(pcbnew.GR_TEXT_H_ALIGN_LEFT)
    t.SetMirrored(mirror)
    board.Add(t)


text("NadiSense ring v2  Rev B", 49.2, -0.7, 0.8)
text("VK26-AU-FD-0015 . Team Ring of Care", 49.2, 0.9, 0.5)
text("+", 45.3, -1.5, 0.6, left=False); text("-", 45.3, 1.5, 0.6, left=False)
for i, (t, x, y) in enumerate([("1", 9.2, 2.3), ("3", 8.0, 2.3), ("5", 8.0, -2.3), ("MR", 41.0, 2.45)]):
    text(t, x, y, 0.45, pcbnew.B_SilkS, left=False, mirror=True)
notes = ["Stackup: 2-layer polyimide flex, 25 um PI core, 12 um Cu (1/3 oz) + plating, 25 um coverlay both sides, ENIG; ~0.11 mm",
         "Stiffeners (User.1): 0.1 mm PI/FR4 on the bottom under the component sections; bend only outside them, min radius 10 mm",
         "Rules: 75/75 um track/space; laser vias 0.2/0.1 mm (via-in-pad, filled + capped) under U1, U2, U5; routing vias 0.35/0.15",
         "U1 WLCSP 0.35 mm pitch: verify land pattern against Nordic PS 7.2.3; U2 against ADI 21-100134; U4 pad 1 orientation vs ST drawing",
         "Antenna: no copper under/around AE1 (rule area); tune C8/L2/C9 pi-match on VNA in the finished ring"]
for i, n in enumerate(notes):
    text(n, 0, 5.0 + i * 1.1, 0.7, pcbnew.Cmts_User)

board.Save(BOARD)
libs = sorted({c[1].split(":")[0] for c in comps.values()})
with open(os.path.join(HERE, "fp-lib-table"), "w") as f:
    f.write("(fp_lib_table\n  (version 7)\n")
    for lib in libs:
        uri = "${KIPRJMOD}/NadiSense.pretty" if lib == "NadiSense" else "${KICAD7_FOOTPRINT_DIR}/%s.pretty" % lib
        f.write(f'  (lib (name "{lib}")(type "KiCad")(uri "{uri}")(options "")(descr ""))\n')
    f.write(")\n")
pcbnew.ExportSpecctraDSN(board, BOARD.replace(".kicad_pcb", ".dsn"))
print(f"placed {len(fps)} parts, {len(nets)} nets, {nfan} via-in-pad fan-outs -> {os.path.basename(BOARD)}")

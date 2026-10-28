"""Generate the NadiSense ring v2 Rev B schematic (KiCad 7) from design.py.

Every pin carries its manufacturer pin/ball number, so the netlist drives real footprints.
Usage: python build_sch.py   (writes NadiSense_ring_v2_revB.kicad_sch + project symbol library)
"""
import os, sys, uuid, math, copy, json
from kiutils.schematic import Schematic
from kiutils.symbol import Symbol, SymbolPin, SymbolLib
from kiutils.items.common import Position, Property, Effects, Font, Stroke, Fill, TitleBlock, Justify
from kiutils.items.syitems import SyRect
from kiutils.items.schitems import (SchematicSymbol, LocalLabel, SymbolProjectInstance, SymbolProjectPath,
                                    HierarchicalSheetInstance, Text, Connection, NoConnect, Rectangle)
import design as D

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = "NadiSense_ring_v2_revB"
KLIB = "/usr/share/kicad/symbols/"
G = 2.54
U = lambda: str(uuid.uuid4())
ROOT = U()


def font(size=1.27, bold=False, italic=False):
    return Effects(font=Font(height=size, width=size, bold=bold, italic=italic))


def hidden():
    e = font(); e.hide = True; return e


lib, placed, wires, ncs, labels, texts, rects = {}, [], [], [], [], [], []
pwr_count = [0]


def std(libname, name):
    lid = f"{libname}:{name}"
    if lid not in lib:
        sl = SymbolLib.from_file(KLIB + libname + ".kicad_sym")
        s = copy.deepcopy([x for x in sl.symbols if x.entryName == name][0])
        s.libraryNickname = libname
        lib[lid] = s
    return lid


def ic_symbol(name, sides, ref="U", value=None):
    """sides: {'L'|'R'|'T'|'B': [([numbers], pin name, electrical type), ...]} - stacked numbers share one spot."""
    lid = f"NadiSense:{name}"
    nl, nr, nt, nb = (len(sides.get(k, [])) for k in "LRTB")
    longest = max([len(e[1]) for k in "LR" for e in sides.get(k, [])] + [4])
    longest_tb = max([len(e[1]) for k in "TB" for e in sides.get(k, [])] + [4])
    halfh = G * math.ceil((max(nl, nr) + 1) / 2 + longest_tb * 1.0 / G * 0.9)
    halfw = G * math.ceil(max(max(nt, nb) + 1, longest * 1.0 / G * 0.95 + 1))
    s = Symbol(); s.libraryNickname = "NadiSense"; s.entryName = name; s.inBom = True; s.onBoard = True
    s.pinNamesOffset = 0.508
    s.properties = [Property(key="Reference", value=ref, id=0, position=Position(-halfw, halfh + 1.27, 0), effects=font(1.27, True)),
                    Property(key="Value", value=value or name, id=1, position=Position(-halfw, -halfh - 1.27, 0), effects=font()),
                    Property(key="Footprint", value="", id=2, position=Position(0, 0, 0), effects=hidden()),
                    Property(key="Datasheet", value="", id=3, position=Position(0, 0, 0), effects=hidden())]
    for p in s.properties[:2]:
        p.effects.justify = Justify(horizontally="left")
    body = Symbol(); body.entryName = name; body.unitId = 0; body.styleId = 1
    body.graphicItems = [SyRect(start=Position(-halfw, halfh), end=Position(halfw, -halfh),
                                stroke=Stroke(width=0.254, type="default"), fill=Fill(type="background"))]
    pu = Symbol(); pu.entryName = name; pu.unitId = 1; pu.styleId = 1
    L = G
    for side, entries in sides.items():
        n = len(entries)
        for i, (nums, pname, etype) in enumerate(entries):
            pitch = 2 * G if side in "TB" else G          # wider pitch on top/bottom so power symbols do not collide
            off = (i - (n - 1) / 2) * pitch
            off = round(off / 1.27) * 1.27
            if side == "L":
                pos = Position(-halfw - L, -off, 0)
            elif side == "R":
                pos = Position(halfw + L, -off, 180)
            elif side == "T":
                pos = Position(off, halfh + L, 270)
            else:
                pos = Position(off, -halfh - L, 90)
            for j, num in enumerate(nums):
                sp = SymbolPin(electricalType=etype, graphicalStyle="line", position=Position(pos.X, pos.Y, pos.angle),
                               length=L, name=pname, number=num, nameEffects=font(1.016), numberEffects=font(0.889))
                sp.hide = j > 0
                pu.pins.append(sp)
    s.units = [body, pu]
    lib[lid] = s
    return lid


def pin_info(lid, X, Y, rot, num):
    for u in lib[lid].units:
        for p in u.pins:
            if p.number == num:
                r = math.radians(rot)
                px, py = p.position.X, p.position.Y
                rx = px * math.cos(r) - py * math.sin(r)
                ry = px * math.sin(r) + py * math.cos(r)
                ang = ((p.position.angle or 0) + rot) % 360        # direction from connection point into the body
                return (round(X + rx, 2), round(Y - ry, 2)), ang
    raise KeyError(num)


def place(lid, ref, value, X, Y, rot=0, footprint="", ref_at=None, val_at=None, hide_val=False):
    s = lib[lid]
    inst = SchematicSymbol(); inst.libraryNickname, inst.entryName = lid.split(":")
    inst.position = Position(X, Y, rot); inst.unit = 1; inst.inBom = not ref.startswith("#")
    inst.onBoard = True; inst.uuid = U()
    rp, vp = s.properties[0].position, s.properties[1].position
    ra = ref_at or (X + rp.X, Y - rp.Y); va = val_at or (X + vp.X, Y - vp.Y)
    re_, ve = font(1.27, True), font()
    if ref.startswith("#"):
        re_.hide = True
    if hide_val:
        ve.hide = True
    if ref_at or val_at:
        re_.justify = Justify(horizontally="left"); ve.justify = Justify(horizontally="left")
    else:
        re_.justify = copy.deepcopy(s.properties[0].effects.justify); ve.justify = copy.deepcopy(s.properties[1].effects.justify)
    inst.properties = [Property(key="Reference", value=ref, id=0, position=Position(round(ra[0], 2), round(ra[1], 2), 0), effects=re_),
                       Property(key="Value", value=value, id=1, position=Position(round(va[0], 2), round(va[1], 2), 0), effects=ve),
                       Property(key="Footprint", value=footprint, id=2, position=Position(X, Y, 0), effects=hidden()),
                       Property(key="Datasheet", value="~", id=3, position=Position(X, Y, 0), effects=hidden())]
    inst.pins = {p.number: U() for u in s.units for p in u.pins}
    inst.instances = [SymbolProjectInstance(name=PROJECT, paths=[SymbolProjectPath(sheetInstancePath=f"/{ROOT}", reference=ref, unit=1)])]
    placed.append(inst)


def wire(a, b):
    wires.append(Connection(type="wire", points=[Position(*a), Position(*b)], stroke=Stroke(width=0, type="default"), uuid=U()))


def label(text, at, ang):
    e = font(1.016); e.justify = Justify(horizontally="right" if ang in (180, 270) else "left")
    labels.append(LocalLabel(text=text, position=Position(at[0], at[1], ang), effects=e, uuid=U()))


def power(net, at):
    pwr_count[0] += 1
    lid = std("power", "GND" if net == "GND" else "+1V8" if net == "+1V8" else "PWR_FLAG")
    place(lid, f"#PWR{pwr_count[0]:03d}", net, at[0], at[1], 0,
          ref_at=(at[0], at[1] + 6), val_at=(at[0] - 1.6, at[1] + (3.6 if net == "GND" else -3.4)))
    placed[-1].properties[1].effects.justify = Justify()
    placed[-1].properties[1].position = Position(at[0], round(at[1] + (3.81 if net == "GND" else -3.3), 2), 0)


def flag(at, rot=0):
    pwr_count[0] += 1
    place(std("power", "PWR_FLAG"), f"#FLG{pwr_count[0]:03d}", "PWR_FLAG", at[0], at[1], rot,
          ref_at=(at[0], at[1] - 6), val_at=(at[0], at[1] + (4.4 if rot == 180 else -3.3)))
    placed[-1].properties[1].effects.justify = Justify()


STEP = {0: (-1, 0), 180: (1, 0), 90: (0, 1), 270: (0, -1)}   # pin angle -> stub direction, schematic coords (y down)


def connect(lid, X, Y, rot, nets, stub=G):
    """Stub + label / power symbol on every pin; no-connect flag on unused pins."""
    done = set()
    for u in lib[lid].units:
        for p in u.pins:
            if p.number in done:
                continue
            (px, py), ang = pin_info(lid, X, Y, rot, p.number)
            stacked = [q.number for q in u.pins if (q.position.X, q.position.Y) == (p.position.X, p.position.Y)]
            done.update(stacked)
            net = next((nets[n] for n in stacked if n in nets), None)
            if net is None:
                ncs.append(NoConnect(position=Position(px, py), uuid=U()))
                continue
            dx, dy = STEP[int(ang)]
            end = (round(px + dx * stub, 2), round(py + dy * stub, 2))
            if net in ("GND", "+1V8"):
                if net == "GND" and dy > 0 or net == "+1V8" and dy < 0:
                    wire((px, py), end); power(net, end)
                else:                                         # side pin: stub then hang the symbol off its end
                    end = (round(px + dx * stub * 2, 2), round(py + dy * stub * 2, 2))
                    wire((px, py), end); power(net, end)
            else:
                wire((px, py), end)
                la = {(-1, 0): 180, (1, 0): 0, (0, -1): 90, (0, 1): 270}[(dx, dy)]
                label(net, end, la)


def block(x0, y0, x1, y1, title, sub=""):
    rects.append(Rectangle(start=Position(x0, y0), end=Position(x1, y1), stroke=Stroke(width=0.3, type="dash"),
                           fill=Fill(type="none"), uuid=U()))
    e = font(2.54, True); e.justify = Justify(horizontally="left", vertically="bottom")
    texts.append(Text(text=title, position=Position(x0 + 1.27, y0 - 1.27, 0), effects=e, uuid=U()))
    if sub:
        note(sub, (x0 + 1.27, y0 + 3.81))


def note(txt, at, size=1.27):
    e = font(size, False, True); e.justify = Justify(horizontally="left", vertically="top")
    texts.append(Text(text=txt, position=Position(at[0], at[1], 0), effects=e, uuid=U()))


# ------------------------------------------------------------------ IC symbols (manufacturer pin numbers)
nrf_used_r = ["C10", "D10", "E10", "F10", "G10", "K7", "A6", "K3", "K2", "A7"]
nrf_top = [(["B3", "B8", "H10", "K1", "K5"], "VDD", "power_in"), (["J10"], "VDDH", "power_in"),
           (["A10"], "DEC1", "power_out"), (["A8"], "DEC4", "power_out"), (["F2"], "DEC5", "passive"),
           (["C2"], "DEC6", "power_out"), (["A9"], "DCC", "passive"), (["H9"], "DCCH", "passive"),
           (["J9"], "VBUS", "power_in"), (["K9"], "DECUSB", "passive")]
vss = [b for b, n in D.NRF_BALLS.items() if n == "VSS"]
nrf_bot = [(vss, "VSS", "power_in"), (["C1"], "VSS_PA", "power_in"), (["J8"], "D-", "bidirectional"), (["K8"], "D+", "bidirectional")]
nrf_left_fixed = ["A1", "A2", "E1", "J2", "H2", "K6", "B10", "B9"]
taken = {b for e in nrf_top + nrf_bot for b in e[0]} | set(nrf_left_fixed) | set(nrf_used_r)
spare = sorted([b for b in D.NRF_BALLS if b not in taken], key=lambda b: D.NRF_BALLS[b])
half = (len(spare) + len(nrf_left_fixed) + len(nrf_used_r)) // 2
left_spare = spare[:half - len(nrf_left_fixed)]
right_spare = spare[half - len(nrf_left_fixed):]
nm = lambda b: D.NRF_BALLS[b]
NRF = ic_symbol("nRF52840-CKAA", {
    "T": nrf_top, "B": nrf_bot,
    "L": [([b], nm(b), "passive" if b in ("A1", "A2") else "bidirectional") for b in nrf_left_fixed + left_spare],
    "R": [([b], nm(b), "bidirectional") for b in nrf_used_r + right_spare]}, value="nRF52840-CKAA")
MAX = ic_symbol("MAX86141", {
    "T": [(["D2"], "VDD_ANA", "power_in"), (["C2"], "VDD_DIG", "power_in"), (["A1"], "VLED", "power_in")],
    "B": [(["C3"], "GND_DIG", "power_in"), (["C4"], "GND_ANA", "power_in"), (["D3"], "PGND", "power_in")],
    "L": [(["D1"], "LED1_DRV", "passive"), (["C1"], "LED2_DRV", "passive"), (["B1"], "LED3_DRV", "passive"),
          (["D5"], "PD1_IN", "input"), (["D4"], "PD2_IN", "input"), (["C5"], "PD_GND", "passive")],
    "R": [(["A2"], "SCLK", "input"), (["A4"], "SDI", "input"), (["A3"], "SDO", "output"), (["A5"], "CSB", "input"),
          (["B2"], "INT", "open_collector"), (["B3"], "GPIO1", "open_collector"), (["B4"], "GPIO2", "open_collector"),
          (["B5"], "VREF", "power_out")]})
TMP = ic_symbol("TMP117xxDRV", {
    "T": [(["5"], "V+", "power_in")], "B": [(["4"], "ADD0", "input"), (["2"], "GND", "power_in"), (["7"], "EP", "passive")],
    "L": [(["1"], "SCL", "input"), (["6"], "SDA", "bidirectional"), (["3"], "ALERT", "open_collector")]})
LIS = ic_symbol("LIS2DW12", {
    "T": [(["9"], "VDD", "power_in"), (["10"], "VDD_IO", "power_in"), (["2"], "CS", "input")],
    "B": [(["3"], "SDO/SA0", "input"), (["6"], "GND", "power_in"), (["8"], "GND", "power_in"), (["7"], "RES", "input")],
    "L": [(["1"], "SCL/SPC", "input"), (["4"], "SDA/SDI", "bidirectional")],
    "R": [(["12"], "INT1", "output"), (["11"], "INT2", "output"), (["5"], "NC", "no_connect")]})
BQ = ic_symbol("BQ25120A", {
    "T": [(["A2"], "IN", "power_in"), (["A3", "B3"], "PMID", "power_out"), (["B4", "C4"], "VINLS", "power_in"), (["B5"], "SYS", "input")],
    "B": [(["A1", "D5"], "GND", "power_in"), (["A5"], "PGND", "power_in"), (["C2"], "ILIM", "input"), (["E3"], "LSCTRL", "input")],
    "L": [(["E4"], "SDA", "bidirectional"), (["E5"], "SCL", "input"), (["D2"], "INT", "open_collector"),
          (["D3"], "RESET", "open_collector"), (["D4"], "PG", "open_collector"), (["E1"], "MR", "input"), (["E2"], "CD", "input")],
    "R": [(["A4"], "SW", "power_out"), (["B1", "B2"], "BAT", "power_out"), (["C5"], "LS/LDO", "power_out"),
          (["C1"], "ISET", "input"), (["D1"], "IPRETERM", "input"), (["C3"], "TS", "input")]})
ANT = ic_symbol("2450AT18A100", {"B": [(["1"], "FEED", "passive")], "T": [(["2"], "NC", "no_connect")]}, ref="AE")
for k in ("Device:C", "Device:R", "Device:L", "Device:LED", "Device:D_Photo", "Device:Crystal_GND24",
          "Device:Battery_Cell", "Connector:TestPoint", "Connector_Generic:Conn_01x02"):
    std(*k.split(":"))
SYM = {"nRF52840": NRF, "MAX86141": MAX, "TMP117": TMP, "LIS2DW12": LIS, "BQ25120A": BQ, "Antenna": ANT}


def put(ref, X, Y, rot=0, stub=G, val_at=None, ref_at=None):
    sym, val, fp, nets = D.PARTS[ref]
    lid = SYM.get(sym, sym)
    if ref in D.DNP:
        val = "DNP"
    if lid.startswith("Device:") and rot == 0 and not ref_at:
        ref_at, val_at = (X + 2.54, Y - 0.6), (X + 2.54, Y + 1.6)
    place(lid, ref, val, X, Y, rot, fp, ref_at=ref_at, val_at=val_at)
    connect(lid, X, Y, rot, nets, stub)


def row(refs, x0, y, dx=10.16):
    for i, r in enumerate(refs):
        put(r, x0 + i * dx, y)


# ------------------------------------------------------------------ sheet layout (A2, mm)
block(20.32, 25.4, 233.68, 213.36, "1  BLE SoC + RF", "nRF52840-CKAA WLCSP, normal-voltage mode (VDD = VDDH = 1.8 V, internal LDOs)")
put("U1", 127.0, 109.22)
row(["C1", "C2", "C3", "C4", "C5"], 45.72, 177.8)
row(["C6", "C7"], 106.68, 177.8)
put("Y1", 101.6, 195.58)
put("C8", 147.32, 177.8); put("L2", 167.64, 177.8, 90); put("C9", 187.96, 177.8); put("AE1", 205.74, 160.02)
note("Pi-match start values (tune on VNA in the potted ring).", (142.24, 200.66))
note("Unused GPIO: no-connect. SWD + nRESET on bottom-side test pads.", (25.4, 205.74))

block(254.0, 25.4, 401.32, 129.54, "2  Optical front-end", "MAX86141 WLP-20, LEDs from VBAT, VDD 1.8 V")
put("U2", 330.2, 76.2)
put("D1", 271.78, 50.8); put("D2", 271.78, 66.04); put("D3", 271.78, 91.44, 0)
row(["C10", "C11", "C12", "C13", "C14"], 345.44, 116.84, 10.16)

block(254.0, 144.78, 401.32, 213.36, "3  Sensors + I2C", "TMP117 (0x48), LIS2DW12 (0x18); 4.7k pull-ups to 1.8 V")
put("U3", 287.02, 177.8); put("U4", 345.44, 177.8)
row(["C15", "C16", "C17"], 266.7, 205.74, 10.16)
row(["R1", "R2", "R3"], 373.38, 160.02, 7.62)

block(20.32, 233.68, 401.32, 375.92, "4  Charger, power path, battery, test pads",
      "BQ25120A: buck SYS output set to 1.8 V (I2C), LS/LDO disabled (LSCTRL low), ILIM to GND = internal default")
put("U5", 165.1, 297.18)
row(["C18", "C19", "C22", "C20"], 50.8, 266.7)
put("L1", 231.14, 266.7, 180, ref_at=(233.68, 266.1), val_at=(233.68, 268.3))
row(["C21", "C23", "R4", "R5", "R6"], 238.76, 309.88, 12.7)
put("J1", 50.8, 337.82, 180, val_at=(45.72, 345.44), ref_at=(45.72, 330.2))
put("BT1", 101.6, 337.82)
for i, tp in enumerate(["TP1", "TP2", "TP3", "TP5", "TP6"]):
    put(tp, 279.4 + i * 17.78, 355.6)
put("TP4", 368.3, 360.68, 180, ref_at=(370.84, 364.49), val_at=(370.84, 366.7))
note("R4/R5 values per TI BQ25120A data sheet (ISET, IPRETERM); charge current also set over I2C (12 mAh cell -> about 10 mA).",
     (25.4, 368.3))

# PWR_FLAGs: one per supply net
power("+1V8", (213.36, 345.44)); wire((213.36, 345.44), (213.36, 350.52)); flag((213.36, 350.52), 180)
flag((228.6, 345.44)); wire((228.6, 345.44), (228.6, 347.98)); power("GND", (228.6, 347.98))
for net, at in (("VBAT", (198.12, 345.44)), ("VIN", (182.88, 345.44))):
    flag(at); wire(at, (at[0], at[1] + 2.54)); label(net, (at[0], at[1] + 2.54), 270)
note("Power flags", (180.34, 330.2))

# ------------------------------------------------------------------ write
sch = Schematic.create_new()
sch.version = 20230121; sch.generator = "eeschema"; sch.uuid = ROOT
sch.paper.paperSize = "A2"
sch.titleBlock = TitleBlock(title="NadiSense ring v2 - system schematic", date="2026-10-28", revision="B",
                            company="Team Ring of Care - Rajalakshmi Engineering College",
                            comments={1: "Vishwakarma Awards 2026-27  VK26-AU-FD-0015",
                                      2: "Rev B: manufacturer pin maps, full support circuitry, one 1.8 V rail"})
sch.libSymbols = list(lib.values())
sch.schematicSymbols = placed
sch.graphicalItems = wires
sch.noConnects = ncs
sch.labels = labels
sch.texts = texts
sch.shapes = rects
sch.sheetInstances = [HierarchicalSheetInstance(instancePath="/", page="1")]
sch.to_file(os.path.join(HERE, f"{PROJECT}.kicad_sch"))
plib = SymbolLib(version=20220914, generator="kicad_symbol_editor")
for lid_, sym_ in lib.items():
    if lid_.startswith("NadiSense:"):
        c_ = copy.deepcopy(sym_); c_.libraryNickname = None; plib.symbols.append(c_)
plib.to_file(os.path.join(HERE, "NadiSense.kicad_sym"))
open(os.path.join(HERE, "sym-lib-table"), "w").write(
    '(sym_lib_table\n  (version 7)\n  (lib (name "NadiSense")(type "KiCad")(uri "${KIPRJMOD}/NadiSense.kicad_sym")(options "")(descr "NadiSense project symbols"))\n)\n')
pro = os.path.join(HERE, f"{PROJECT}.kicad_pro")
if not os.path.exists(pro):
    json.dump({"meta": {"filename": f"{PROJECT}.kicad_pro", "version": 1}, "sheets": [[ROOT, "Root"]]}, open(pro, "w"), indent=2)
print("symbols", len([p for p in placed if not p.properties[0].value.startswith("#")]), "wires", len(wires),
      "labels", len(labels), "no-connects", len(ncs))

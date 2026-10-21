"""NadiSense ring v2 — wired KiCad 7 schematic using KiCad standard library symbols.

Usage: python kicad_gen2.py <out_dir>
"""
import sys, uuid, json, math, copy
from kiutils.schematic import Schematic
from kiutils.symbol import Symbol, SymbolPin, SymbolLib
from kiutils.items.common import Position, Property, Effects, Font, Stroke, Fill, TitleBlock, Justify
from kiutils.items.syitems import SyRect
from kiutils.items.schitems import (SchematicSymbol, LocalLabel, SymbolProjectInstance, SymbolProjectPath,
                                    HierarchicalSheetInstance, Text, Connection, Junction, NoConnect, Rectangle)

OUT = sys.argv[1]
G = 2.54
U = lambda: str(uuid.uuid4())
ROOT = U()
PROJECT = "NadiSense_ring_v2"
KLIB = "/usr/share/kicad/symbols/"


def font(size=1.27, bold=False, italic=False):
    return Effects(font=Font(height=size, width=size, bold=bold, italic=italic))


def hidden():
    e = font(); e.hide = True; return e


lib = {}          # lib_id -> Symbol
placed = []
wires, juncs, ncs, labels, texts, rects = [], [], [], [], [], []
pwr_n = [0]


def std(libname, name, newname=None, value=None):
    """Copy a KiCad standard symbol into the schematic's lib_symbols."""
    lid = f"{libname}:{newname or name}"
    if lid in lib:
        return lid
    sl = SymbolLib.from_file(KLIB + libname + ".kicad_sym")
    s = copy.deepcopy([x for x in sl.symbols if x.entryName == name][0])
    s.libraryNickname = libname
    if newname:
        s.entryName = newname
        for u in s.units:
            u.entryName = newname
        for p in s.properties:
            if p.key == "Value":
                p.value = value or newname
        for u in s.units:
            for p in u.pins:
                p.name = value or newname
    lib[lid] = s
    return lid


def custom(name, halfw, halfh, pins):
    """pins: list of (name, type, side, offset) with offset along the side in mm (from centre)."""
    lid = f"NadiSense:{name}"
    s = Symbol(); s.libraryNickname = "NadiSense"; s.entryName = name; s.inBom = True; s.onBoard = True
    s.pinNamesOffset = 1.016
    s.properties = [Property(key="Reference", value="U", id=0, position=Position(0, halfh + 1.905, 0), effects=font()),
                    Property(key="Value", value=name, id=1, position=Position(0, -halfh - 1.905, 0), effects=font()),
                    Property(key="Footprint", value="", id=2, position=Position(0, 0, 0), effects=hidden()),
                    Property(key="Datasheet", value="", id=3, position=Position(0, 0, 0), effects=hidden())]
    body = Symbol(); body.entryName = name; body.unitId = 0; body.styleId = 1
    body.graphicItems = [SyRect(start=Position(-halfw, halfh), end=Position(halfw, -halfh),
                                stroke=Stroke(width=0.254, type="default"), fill=Fill(type="background"))]
    pu = Symbol(); pu.entryName = name; pu.unitId = 1; pu.styleId = 1
    L = 5.08
    for i, (pn, t, side, off) in enumerate(pins):
        if side == "L":
            pos = Position(-halfw - L, off, 0)
        elif side == "R":
            pos = Position(halfw + L, off, 180)
        elif side == "T":
            pos = Position(off, halfh + L, 270)
        else:
            pos = Position(off, -halfh - L, 90)
        pu.pins.append(SymbolPin(electricalType=t, graphicalStyle="line", position=pos, length=L, name=pn,
                                 number=str(i + 1), nameEffects=font(), numberEffects=font()))
    s.units = [body, pu]
    lib[lid] = s
    return lid


def pin_abs(lid, X, Y, rot, pinname):
    s = lib[lid]
    for u in s.units:
        for p in u.pins:
            if p.name == pinname or p.number == pinname:
                px, py = p.position.X, p.position.Y
                r = math.radians(rot)
                rx = px * math.cos(r) - py * math.sin(r)
                ry = px * math.sin(r) + py * math.cos(r)
                return (round(X + rx, 2), round(Y - ry, 2))
    raise KeyError(pinname)


def place(lid, ref, value, X, Y, rot=0, ref_off=None, val_off=None, hide_ref=False, footprint="", just="left", hide_val=False):
    s = lib[lid]
    inst = SchematicSymbol(); inst.libraryNickname = lid.split(":")[0]; inst.entryName = lid.split(":")[1]
    inst.position = Position(X, Y, rot); inst.unit = 1; inst.inBom = not ref.startswith("#"); inst.onBoard = True; inst.uuid = U()
    rp = s.properties[0].position; vp = s.properties[1].position
    ro = ref_off or (rp.X, -rp.Y) if rot == 0 else (ref_off or (3.81, -1.27))
    vo = val_off or (vp.X, -vp.Y) if rot == 0 else (val_off or (3.81, 1.27))
    re = font(1.27, True); ve = font()
    if hide_ref:
        re.hide = True
    for e in (re, ve):
        if rot == 0 and ref_off is None and lid.startswith("NadiSense"):
            pass
    fa = (360 - rot) % 360 if rot in (90, 270) else 0
    if hide_val:
        ve.hide = True
    inst.properties = [Property(key="Reference", value=ref, id=0, position=Position(round(X + ro[0], 2), round(Y + ro[1], 2), fa), effects=re),
                       Property(key="Value", value=value, id=1, position=Position(round(X + vo[0], 2), round(Y + vo[1], 2), fa), effects=ve),
                       Property(key="Footprint", value=footprint, id=2, position=Position(X, Y, 0), effects=hidden()),
                       Property(key="Datasheet", value="~", id=3, position=Position(X, Y, 0), effects=hidden())]
    if ref_off is not None or val_off is not None or rot != 0:
        for p in inst.properties[:2]:
            p.effects.justify = Justify(horizontally=just)
    inst.pins = {}
    for u in s.units:
        for p in u.pins:
            inst.pins[p.number] = U()
    inst.instances = [SymbolProjectInstance(name=PROJECT, paths=[SymbolProjectPath(sheetInstancePath=f"/{ROOT}", reference=ref, unit=1)])]
    placed.append(inst)
    return lambda pn: pin_abs(lid, X, Y, rot, pn)


def pwr(net, at, rot=0):
    lid = {"GND": std("power", "GND"), "+1V8": std("power", "+1V8")}.get(net) or std("power", "+1V8", net, net)
    pwr_n[0] += 1
    place(lid, f"#PWR{pwr_n[0]:02d}", net, at[0], at[1], rot,
          ref_off=(0, 6.35) if net == "GND" else (0, -3.81), val_off=(0, 3.81) if net == "GND" else (0, -3.556), hide_ref=True)
    v = placed[-1].properties[1]; v.effects.justify = Justify()
    v.position = Position(at[0], round(at[1] + (3.81 if net == "GND" else -3.556), 2), 0)


def wire(*pts):
    for a, b in zip(pts, pts[1:]):
        wires.append(Connection(type="wire", points=[Position(*a), Position(*b)], stroke=Stroke(width=0, type="default"), uuid=U()))


def label(text, at, ang=0):
    e = font(); e.justify = Justify(horizontally="left" if ang == 0 else "right", vertically="bottom")
    labels.append(LocalLabel(text=text, position=Position(at[0], at[1], 0), effects=e, uuid=U()))


def junction(at):
    juncs.append(Junction(position=Position(*at), diameter=0, uuid=U()))


def nc(at):
    ncs.append(NoConnect(position=Position(*at), uuid=U()))


def block(x0, y0, x1, y1, title):
    rects.append(Rectangle(start=Position(x0, y0), end=Position(x1, y1), stroke=Stroke(width=0.254, type="dash"),
                           fill=Fill(type="none"), uuid=U()))
    e = font(2.0, True); e.justify = Justify(horizontally="left", vertically="bottom")
    texts.append(Text(text=title, position=Position(round(x0 + 1.27, 2), round(y0 - 1.27, 2), 0), effects=e, uuid=U()))


def note(txt, at, size=1.524):
    e = font(size, False, True); e.justify = Justify(horizontally="left")
    texts.append(Text(text=txt, position=Position(*at, 0), effects=e, uuid=U()))


# ------------------------------------------------------------------ symbols
R = std("Device", "R"); C = std("Device", "C"); LED = std("Device", "LED"); PD = std("Device", "D_Photo")
XT = std("Device", "Crystal"); ANT = std("Device", "Antenna_Chip"); BAT = std("Device", "Battery_Cell")
IND = std("Device", "L"); J2 = std("Connector", "Conn_01x02_Pin")

NRF = custom("nRF52840", 15.24, 20.32, [
    ("P0.04/SCK", "output", "L", 12.7), ("P0.05/MOSI", "output", "L", 7.62), ("P0.06/MISO", "input", "L", 2.54),
    ("P0.07/CS", "output", "L", -2.54), ("P0.08/INT", "input", "L", -7.62),
    ("P0.26/SDA", "bidirectional", "R", 12.7), ("P0.27/SCL", "bidirectional", "R", 7.62), ("P0.11", "input", "R", 2.54),
    ("P0.12", "input", "R", -2.54), ("P0.13", "input", "R", -7.62),
    ("DCCH", "passive", "T", -10.16), ("VDDH", "power_in", "T", 0), ("VDD", "power_out", "T", 10.16),
    ("XC1", "passive", "B", -10.16), ("XC2", "passive", "B", -5.08), ("ANT", "bidirectional", "B", 5.08),
    ("VSS", "power_in", "B", 10.16)])
AFE = custom("MAX86141", 10.16, 20.32, [
    ("LED1_DRV", "passive", "L", 12.7), ("LED2_DRV", "passive", "L", 7.62), ("PD1_IN", "input", "L", 2.54),
    ("PD_GND", "passive", "L", -2.54),
    ("SCLK", "input", "R", 12.7), ("SDI", "input", "R", 7.62), ("SDO", "output", "R", 2.54), ("CSB", "input", "R", -2.54),
    ("INTB", "open_collector", "R", -7.62),
    ("VDD", "power_in", "T", -5.08), ("VLED", "power_in", "T", 5.08), ("GND", "power_in", "B", 0)])
TMP = custom("TMP117", 7.62, 15.24, [
    ("SCL", "input", "L", 7.62), ("SDA", "bidirectional", "L", 2.54), ("ALERT", "open_collector", "L", -2.54),
    ("ADD0", "input", "L", -7.62), ("V+", "power_in", "T", 0), ("GND", "power_in", "B", 0)])
ACC = custom("LIS2DW12", 7.62, 20.32, [
    ("SCL", "input", "L", 12.7), ("SDA", "bidirectional", "L", 7.62), ("CS", "input", "L", 2.54), ("SA0", "input", "L", -2.54),
    ("INT1", "output", "L", -7.62), ("INT2", "output", "L", -12.7),
    ("VDD", "power_in", "T", -2.54), ("VDD_IO", "power_in", "T", 5.08), ("GND", "power_in", "B", 0)])
CHG = custom("BQ25120A", 10.16, 12.7, [
    ("SDA", "bidirectional", "L", 10.16), ("SCL", "input", "L", 5.08), ("INT", "open_collector", "L", 0),
    ("IN", "power_in", "R", 10.16), ("BAT", "power_out", "R", 5.08), ("SW", "power_out", "R", 0), ("SYS", "power_in", "R", -5.08),
    ("GND", "power_in", "B", 0)])

# ------------------------------------------------------------------ optical front-end
block(81.28, 83.82, 167.64, 160.02, "OPTICAL FRONT-END")
u2 = place(AFE, "U2", "MAX86141", 134.62, 121.92, ref_off=(-10.16, -21.59), val_off=(0, 12.7)); placed[-1].properties[1].effects.justify = Justify()
d1 = place(LED, "D1", "Red 660 nm", 109.22, 96.52, 90, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
d2 = place(LED, "D2", "IR 880 nm", 96.52, 96.52, 90, ref_off=(-2.54, -1.27), val_off=(-2.54, 1.27), just="right")
pd1 = place(PD, "D3", "Si PIN photodiode", 109.22, 140.97, 270, ref_off=(-2.54, -1.27), val_off=(-2.54, 1.27), just="right")
wire(d1("K"), (109.22, u2("LED1_DRV")[1]), u2("LED1_DRV"))
wire(d2("K"), (96.52, u2("LED2_DRV")[1]), u2("LED2_DRV"))
wire(pd1("K"), (109.22, u2("PD1_IN")[1]), u2("PD1_IN"))
pwr("VBAT", d1("A")); pwr("VBAT", d2("A")); pwr("GND", pd1("A"))
pg = u2("PD_GND"); wire(pg, (pg[0] - 5.08, pg[1]), (pg[0] - 5.08, pg[1] + 2.54)); pwr("GND", (pg[0] - 5.08, pg[1] + 2.54))
pwr("+1V8", u2("VDD")); pwr("VBAT", u2("VLED")); pwr("GND", u2("GND"))
note("LED anodes on VBAT; MAX86141 drivers\\nsink the cathodes (0-124 mA, set in firmware)", (83.82, 154.94), 1.27)

# ------------------------------------------------------------------ MCU + radio
block(172.72, 83.82, 270.51, 187.96, "MCU + BLE RADIO")
u1 = place(NRF, "U1", "nRF52840-QIAA", 218.44, 121.92, ref_off=(-15.24, -21.59), val_off=(0, 13.97)); placed[-1].properties[1].effects.justify = Justify()
for a, b, n in [("SCLK", "P0.04/SCK", "SPI_SCK"), ("SDI", "P0.05/MOSI", "SPI_MOSI"), ("SDO", "P0.06/MISO", "SPI_MISO"),
                ("CSB", "P0.07/CS", "AFE_CS"), ("INTB", "P0.08/INT", "AFE_INT")]:
    wire(u2(a), u1(b)); label(n, (u2(a)[0] + 7.62, u2(a)[1]))
dc = u1("DCCH")
c6 = place(C, "C6", "10nF", 187.96, 95.25, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
wire(dc, (dc[0], 91.44), (187.96, 91.44)); pwr("GND", c6("2"))
pwr("VSYS", u1("VDDH")); pwr("+1V8", u1("VDD"))
y1 = place(XT, "Y1", "32MHz", 205.74, 160.02, ref_off=(-1.27, -3.81), val_off=(-1.27, -6.35))
x1, x2 = u1("XC1"), u1("XC2")
wire(x1, (x1[0], 152.4), (y1("1")[0], 152.4), y1("1")); wire(x2, (x2[0], y1("2")[1])) if abs(x2[0] - y1("2")[0]) < 0.01 else wire(x2, (x2[0], 152.4 + 2.54), (y1("2")[0], 154.94), y1("2"))
c7 = place(C, "C7", "12pF", y1("1")[0], 168.91, ref_off=(-2.54, -1.27), val_off=(-2.54, 1.27), just="right")
c8 = place(C, "C8", "12pF", y1("2")[0], 168.91, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
wire(y1("1"), c7("1")); wire(y1("2"), c8("1")); junction(y1("1")); junction(y1("2"))
pwr("GND", c7("2")); pwr("GND", c8("2"))
ae = place(ANT, "AE1", "2450AT18A100", 241.3, 157.48, 0, ref_off=(5.08, -5.08), val_off=(5.08, -2.54))
an = u1("ANT"); fd = ae("FEED"); wire(an, (an[0], fd[1] + 5.08), (fd[0], fd[1] + 5.08), fd)
nc(ae("PCB_Trace"))
pwr("GND", u1("VSS"))
for pn, n in [("P0.26/SDA", "I2C_SDA"), ("P0.27/SCL", "I2C_SCL"), ("P0.11", "ACC_INT"), ("P0.12", "TEMP_ALRT"), ("P0.13", "CHG_INT")]:
    p = u1(pn)
    end = (p[0] + (20.32 if n == "I2C_SCL" else 12.7), p[1])
    wire(p, end); label(n, (p[0] + 2.54, p[1]))
r1 = place(R, "R1", "4.7k", 246.38, 102.87, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
r2 = place(R, "R2", "4.7k", 256.54, 107.95, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
sda, scl = u1("P0.26/SDA"), u1("P0.27/SCL")
wire(r1("2"), (246.38, sda[1]))
wire(r2("2"), (256.54, scl[1]))
pwr("+1V8", r1("1")); pwr("+1V8", r2("1"))
note("Pull-ups 4.7k to +1V8, one I2C bus at 400 kHz", (175.26, 184.15), 1.27)

# ------------------------------------------------------------------ sensors
block(281.94, 83.82, 401.32, 170.18, "SENSORS")
u3 = place(TMP, "U3", "TMP117AIDRVR", 317.5, 129.54, ref_off=(-7.62, -16.51), val_off=(0, 11.43)); placed[-1].properties[1].effects.justify = Justify()
for pn, n in [("SCL", "I2C_SCL"), ("SDA", "I2C_SDA"), ("ALERT", "TEMP_ALRT")]:
    p = u3(pn); wire(p, (p[0] - 12.7, p[1])); label(n, (p[0] - 12.7, p[1]))
ad = u3("ADD0"); wire(ad, (ad[0] - 5.08, ad[1]), (ad[0] - 5.08, ad[1] + 2.54)); pwr("GND", (ad[0] - 5.08, ad[1] + 2.54))
pwr("+1V8", u3("V+")); pwr("GND", u3("GND"))
c2 = place(C, "C2", "100nF", 332.74, 110.49, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
pwr("+1V8", c2("1")); pwr("GND", c2("2"))
note("U3: ADD0 = GND -> address 0x48", (284.48, 161.29), 1.27)

u4 = place(ACC, "U4", "LIS2DW12TR", 378.46, 129.54, ref_off=(-7.62, -21.59), val_off=(0, 16.51)); placed[-1].properties[1].effects.justify = Justify()
for pn, n in [("SCL", "I2C_SCL"), ("SDA", "I2C_SDA"), ("INT1", "ACC_INT")]:
    p = u4(pn); wire(p, (p[0] - 12.7, p[1])); label(n, (p[0] - 12.7, p[1]))
cs, sa = u4("CS"), u4("SA0")
wire(cs, (cs[0] - 5.08, cs[1])); wire(sa, (sa[0] - 5.08, sa[1])); wire((cs[0] - 5.08, cs[1]), (sa[0] - 5.08, sa[1]))
junction((sa[0] - 5.08, sa[1])) if False else None
pwr("+1V8", (cs[0] - 5.08, cs[1])); junction((cs[0] - 5.08, cs[1]))
nc(u4("INT2"))
pwr("+1V8", u4("VDD")); pwr("+1V8", u4("VDD_IO")); pwr("GND", u4("GND"))
c9 = place(C, "C9", "100nF", 393.7, 100.33, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
pwr("+1V8", c9("1")); pwr("GND", c9("2"))
note("U4: CS = SA0 = +1V8 -> I2C mode, address 0x19", (284.48, 166.37), 1.27)

# ------------------------------------------------------------------ power
block(81.28, 200.66, 165.1, 259.08, "DECOUPLING")
for i, (ref, val, net) in enumerate([("C1", "1uF", "+1V8"), ("C10", "100nF", "+1V8"), ("C3", "1uF", "VBAT"),
                                     ("C11", "10uF", "VBAT")]):
    c = place(C, ref, val, 91.44 + i * 17.78, 227.33, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
    pwr(net, c("1")); pwr("GND", c("2"))
note("One 100 nF / 1 uF next to each supply pin", (83.82, 254.0), 1.27)

block(172.72, 200.66, 294.64, 264.16, "CHARGER + BATTERY")
u5 = place(CHG, "U5", "BQ25120AYFPR", 205.74, 226.06, ref_off=(-10.16, -14.0), val_off=(0, 8.89)); placed[-1].properties[1].effects.justify = Justify()
for pn, n in [("SDA", "I2C_SDA"), ("SCL", "I2C_SCL"), ("INT", "CHG_INT")]:
    p = u5(pn); wire(p, (p[0] - 12.7, p[1])); label(n, (p[0] - 12.7, p[1]))
pwr("GND", u5("GND"))
vin = u5("IN")
j1 = place(J2, "J1", "Pogo pads", 279.4, vin[1] + 2.54, 180, ref_off=(2.54, -3.81), val_off=(2.54, 3.81))
wire(vin, j1("Pin_2"))
pj = j1("Pin_1"); wire(pj, (pj[0] - 5.08, pj[1]), (pj[0] - 5.08, pj[1] + 2.54)); pwr("GND", (pj[0] - 5.08, pj[1] + 2.54))
c5 = place(C, "C5", "1uF", 251.46, vin[1] + 3.81, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
junction(c5("1")); pwr("GND", c5("2"))
bt = u5("BAT"); wire(bt, (bt[0] + 5.08, bt[1])); pwr("VBAT", (bt[0] + 5.08, bt[1]))
sw, sy = u5("SW"), u5("SYS")
l1 = place(IND, "L1", "2.2uH", sw[0] + 8.89, sw[1], 90, ref_off=(-1.27, -2.54), val_off=(-1.27, 3.81))
wire(sw, l1("1"))
wire(l1("2"), (l1("2")[0] + 2.54, sw[1]), (l1("2")[0] + 2.54, sy[1])); junction((l1("2")[0] + 2.54, sy[1]))
wire(sy, (sy[0] + 38.1, sy[1]))
c4 = place(C, "C4", "10uF", sy[0] + 25.4, sy[1] + 3.81, ref_off=(2.54, -1.27), val_off=(2.54, 1.27))
junction(c4("1")); pwr("GND", c4("2"))
pwr("VSYS", (sy[0] + 38.1, sy[1]))
bt1 = place(BAT, "BT1", "Li-Po 3.7V 12mAh", 269.24, 246.38, ref_off=(3.81, -1.27), val_off=(3.81, 1.27))
pwr("VBAT", bt1("+")); pwr("GND", bt1("-"))
note("SYS buck = 3.3 V (set over I2C) -> nRF52840 VDDH; REG0 makes +1V8", (175.26, 261.62), 1.27)

# ------------------------------------------------------------------ split wires at every connection point
def all_points():
    pts = set()
    for inst in placed:
        lid = f"{inst.libraryNickname}:{inst.entryName}"
        for u in lib[lid].units:
            for p in u.pins:
                pts.add(pin_abs(lid, inst.position.X, inst.position.Y, inst.position.angle or 0, p.number))
    for w in wires:
        for p in w.points:
            pts.add((round(p.X, 2), round(p.Y, 2)))
    for j in juncs:
        pts.add((round(j.position.X, 2), round(j.position.Y, 2)))
    return pts


def split_wires():
    pts = all_points()
    out = []
    for w in wires:
        a, b = w.points
        ax, ay, bx, by = round(a.X, 2), round(a.Y, 2), round(b.X, 2), round(b.Y, 2)
        inner = []
        for (px, py) in pts:
            if ax == bx == px and min(ay, by) < py < max(ay, by):
                inner.append((px, py))
            elif ay == by == py and min(ax, bx) < px < max(ax, bx):
                inner.append((px, py))
        seq = sorted(inner, key=lambda q: abs(q[0] - ax) + abs(q[1] - ay))
        chain = [(ax, ay)] + seq + [(bx, by)]
        for p, q in zip(chain, chain[1:]):
            out.append(Connection(type="wire", points=[Position(*p), Position(*q)], stroke=Stroke(width=0, type="default"), uuid=U()))
    # junction wherever 3+ items meet
    deg = {}
    for w in out:
        for p in w.points:
            k = (p.X, p.Y); deg[k] = deg.get(k, 0) + 1
    pinpts = set()
    for inst in placed:
        lid = f"{inst.libraryNickname}:{inst.entryName}"
        for u in lib[lid].units:
            for p in u.pins:
                pinpts.add(pin_abs(lid, inst.position.X, inst.position.Y, inst.position.angle or 0, p.number))
    have = {(j.position.X, j.position.Y) for j in juncs}
    for k, d in deg.items():
        if d + (1 if k in pinpts else 0) >= 3 and k not in have:
            juncs.append(Junction(position=Position(*k), diameter=0, uuid=U()))
    return out


wires[:] = split_wires()

# ------------------------------------------------------------------ assemble
sch = Schematic.create_new()
sch.version = 20230121; sch.generator = "eeschema"; sch.uuid = ROOT
sch.paper.paperSize = "A3"
sch.titleBlock = TitleBlock(title="NadiSense ring v2 - system schematic", date="2026-10-22", revision="A",
                            company="Rajalakshmi Engineering College",
                            comments={1: "Vishwakarma Awards 2026-27  VK26-AU-FD-0015", 2: "Sheet 1/1  -  all logic on one 1.8 V rail"})
sch.libSymbols = list(lib.values())
sch.schematicSymbols = placed
sch.graphicalItems = wires
sch.junctions = juncs
sch.noConnects = ncs
sch.labels = labels
sch.texts = texts
sch.shapes = rects
sch.sheetInstances = [HierarchicalSheetInstance(instancePath="/", page="1")]
sch.to_file(f"{OUT}/{PROJECT}.kicad_sch")
json.dump({"meta": {"filename": f"{PROJECT}.kicad_pro", "version": 1}, "sheets": [[ROOT, "Root"]]},
          open(f"{OUT}/{PROJECT}.kicad_pro", "w"), indent=2)
print("symbols", len(placed), "wires", len(wires), "labels", len(labels))

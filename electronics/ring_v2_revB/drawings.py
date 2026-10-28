"""Clear review drawings drawn straight from the board data: routing view (no pours) and assembly drawing.

Usage: python drawings.py   -> images/pcb_routing.png, images/pcb_assembly_top.png, images/pcb_assembly_bottom.png
"""
import os, math
import pcbnew
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "images"); os.makedirs(IMG, exist_ok=True)
b = pcbnew.LoadBoard(os.path.join(HERE, "NadiSense_ring_v2_revB.kicad_pcb"))
T = pcbnew.ToMM
X0, Y0, W = 100.0, 100.0, 6.0
S = 110                                   # px per mm
SEGS = [(2.6, 25.6), (25.4, 48.4)]        # two rows: SoC side, sensor/charger side
FB = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
FR = "/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf"
font = lambda f, s: ImageFont.truetype(f, s)

tracks = [t for t in b.GetTracks()]
fps = list(b.GetFootprints())


def pad_shapes():
    out = []
    for fp in fps:
        for p in fp.Pads():
            bb = p.GetBoundingBox()
            out.append(dict(ref=fp.GetReference(), num=p.GetNumber(), net=p.GetNetname(),
                            F=p.IsOnLayer(pcbnew.F_Cu), B=p.IsOnLayer(pcbnew.B_Cu),
                            circle=p.GetShape() == pcbnew.PAD_SHAPE_CIRCLE,
                            box=(T(bb.GetLeft()) - X0, T(bb.GetTop()) - Y0, T(bb.GetRight()) - X0, T(bb.GetBottom()) - Y0)))
    return out


PADS = pad_shapes()


def fab_box(fp):
    bb = None
    for g in fp.GraphicalItems():
        if g.GetLayer() in (pcbnew.F_Fab, pcbnew.B_Fab) and g.GetClass() == "FP_SHAPE":
            gb = g.GetBoundingBox()
            bb = gb if bb is None else (bb.Merge(gb) or bb)
    if bb is None:
        bb = fp.GetBoundingBox(False, False)
    return (T(bb.GetLeft()) - X0, T(bb.GetTop()) - Y0, T(bb.GetRight()) - X0, T(bb.GetBottom()) - Y0)


PARTS = [dict(ref=fp.GetReference(), val=fp.GetValue(), bottom=fp.IsFlipped(), box=fab_box(fp)) for fp in fps]


def canvas(seg, bg, margin=0.35):
    x0, x1 = seg
    w, h = int((x1 - x0 + 2 * margin) * S), int((W + 2 * margin) * S)
    im = Image.new("RGB", (w, h), bg)
    tf = lambda x, y: ((x - x0 + margin) * S, (y + W / 2 + margin) * S)
    return im, ImageDraw.Draw(im), tf


def outline(d, tf, col, width=3):
    r = 0.5
    d.rounded_rectangle([tf(0, -3), tf(66.8, 3)], radius=r * S, outline=col, width=width)


def routing(seg):
    im, d, tf = canvas(seg, (14, 22, 34))
    d.rectangle([tf(0, -3), tf(66.8, 3)], fill=(22, 34, 50))
    for z in b.Zones():
        if z.GetIsRuleArea() and z.GetZoneName() in ("ANTENNA_KEEPOUT", "OPTICAL_WINDOW"):
            bb = z.GetBoundingBox()
            p0, p1 = tf(T(bb.GetLeft()) - X0, T(bb.GetTop()) - Y0), tf(T(bb.GetRight()) - X0, T(bb.GetBottom()) - Y0)
            d.rectangle([p0, p1], outline=(200, 200, 90), width=2)
    for layer, col in ((pcbnew.B_Cu, (70, 120, 235)), (pcbnew.F_Cu, (225, 70, 70))):
        for t in tracks:
            if t.GetClass() == "PCB_TRACK" and t.GetLayer() == layer:
                a, c = t.GetStart(), t.GetEnd()
                d.line([tf(T(a.x) - X0, T(a.y) - Y0), tf(T(c.x) - X0, T(c.y) - Y0)], fill=col, width=max(2, int(T(t.GetWidth()) * S)))
                for p in (a, c):
                    x, y = tf(T(p.x) - X0, T(p.y) - Y0); r = T(t.GetWidth()) * S / 2
                    d.ellipse([x - r, y - r, x + r, y + r], fill=col)
        for p in PADS:
            if (layer == pcbnew.F_Cu and p["F"]) or (layer == pcbnew.B_Cu and p["B"] and not p["F"]):
                x0, y0, x1, y1 = p["box"]
                pc = (240, 120, 120) if layer == pcbnew.F_Cu else (120, 160, 245)
                if not p["net"]:
                    pc = (120, 120, 130)
                (d.ellipse if p["circle"] else d.rectangle)([tf(x0, y0), tf(x1, y1)], fill=pc)
    for t in tracks:
        if t.GetClass() == "PCB_VIA":
            x, y = tf(T(t.GetPosition().x) - X0, T(t.GetPosition().y) - Y0)
            r, rh = T(t.GetWidth()) * S / 2, T(t.GetDrillValue()) * S / 2
            col = (200, 170, 70) if t.GetNetname() == "GND" else (235, 235, 235)
            d.ellipse([x - r, y - r, x + r, y + r], fill=col); d.ellipse([x - rh, y - rh, x + rh, y + rh], fill=(14, 22, 34))
    f = font(FB, 30)
    for pt in PARTS:
        if pt["bottom"] or pt["ref"] in ("BT1",):
            continue
        x0, y0, x1, y1 = pt["box"]
        if pt["ref"][0] in "UDYJ" or pt["ref"] in ("AE1", "L1"):
            cx, cy = tf((x0 + x1) / 2, (y0 + y1) / 2)
            d.text((cx, cy), pt["ref"], font=f, fill=(255, 255, 255), anchor="mm", stroke_width=3, stroke_fill=(14, 22, 34))
    outline(d, tf, (230, 205, 70))
    return im


def assembly(seg, side):
    im, d, tf = canvas(seg, (255, 255, 255))
    d.rectangle([tf(0, -3), tf(66.8, 3)], fill=(250, 246, 236))
    for p in PADS:
        if (side == "top" and p["F"]) or (side == "bottom" and p["B"] and not p["F"]):
            x0, y0, x1, y1 = p["box"]
            (d.ellipse if p["circle"] else d.rectangle)([tf(x0, y0), tf(x1, y1)], fill=(214, 200, 170))
    fb, fs = font(FB, 26), font(FR, 18)
    for pt in PARTS:
        if (side == "top") == pt["bottom"]:
            continue
        x0, y0, x1, y1 = pt["box"]
        d.rectangle([tf(x0, y0), tf(x1, y1)], outline=(30, 30, 35), width=3)
        cx, cy = tf((x0 + x1) / 2, (y0 + y1) / 2)
        big = (x1 - x0) * (y1 - y0) > 1.5
        if big:
            d.text((cx, cy - 12), pt["ref"], font=font(FB, 34), fill=(15, 23, 42), anchor="mm")
            d.text((cx, cy + 20), pt["val"], font=fs, fill=(70, 80, 95), anchor="mm")
        else:
            # small parts: label beside the body, away from the strip centre
            up = (y0 + y1) / 2 < 0
            ty = tf(0, y0 - 0.05)[1] - 4 if up else tf(0, y1 + 0.05)[1] + 4
            if up and ty < 30 or not up and ty > im.size[1] - 30:
                ty = cy
            d.text((cx, ty), pt["ref"], font=fb, fill=(15, 23, 42), anchor="mb" if up else "mt",
                   stroke_width=3, stroke_fill=(250, 246, 236))
    outline(d, tf, (60, 60, 60))
    return im


def stack(rows, title, sub, bg=(255, 255, 255), fg=(15, 23, 42)):
    w = max(r.size[0] for r in rows) + 60
    h = sum(r.size[1] for r in rows) + 40 * len(rows) + 130
    out = Image.new("RGB", (w, h), bg); d = ImageDraw.Draw(out)
    d.text((30, 22), title, font=font(FB, 40), fill=fg)
    d.text((30, 74), sub, font=font(FR, 24), fill=(110, 120, 135) if bg[0] > 128 else (170, 180, 195))
    y = 120
    for (x0, x1), r in zip(SEGS, rows):
        d.text((30, y), f"{x0:.0f} - {x1:.0f} mm along the strip", font=font(FR, 22), fill=(110, 120, 135) if bg[0] > 128 else (170, 180, 195))
        out.paste(r, (30, y + 30)); y += r.size[1] + 40
    return out


stack([routing(s) for s in SEGS], "NadiSense ring v2 flex PCB, Rev B: routing (pours hidden)",
      "Red = top copper (parts side, faces the finger)   Blue = bottom copper   Gold = GND vias   White = signal vias   Yellow boxes = antenna keep-out, optical window",
      bg=(14, 22, 34), fg=(240, 240, 240)).save(os.path.join(IMG, "pcb_routing.png"))
stack([assembly(s, "top") for s in SEGS], "NadiSense ring v2 flex PCB, Rev B: assembly drawing, top side",
      "All components on the top side (faces the finger). Reference designators match the schematic and BOM.").save(
    os.path.join(IMG, "pcb_assembly_top.png"))
bot = assembly((2.6, 25.6), "bottom")
bw = Image.new("RGB", (bot.size[0] + 60, bot.size[1] + 170), "white"); dd = ImageDraw.Draw(bw)
dd.text((30, 22), "Bottom side: programming / test pads", font=font(FB, 40), fill=(15, 23, 42))
dd.text((30, 74), "TP1 SWDIO   TP2 SWDCLK   TP3 nRESET   TP4 +1V8   TP5 GND   (TP6 MR sits by the charger at 41 mm)",
        font=font(FR, 24), fill=(110, 120, 135))
bw.paste(bot, (30, 130)); bw.save(os.path.join(IMG, "pcb_assembly_bottom.png"))
print("drawings written")

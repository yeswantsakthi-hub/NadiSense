"""Fabrication outputs, BOM and review images for the Rev B flex PCB.

Usage: python make_outputs.py <scratch_dir_for_svgs>
Writes: fab/ (Gerbers, drill, pick-and-place, BOM), NadiSense_ring_v2_revB_gerbers.zip,
        layer PDFs, schematic PDF, images/*.png
"""
import os, sys, subprocess, csv, zipfile, glob
import numpy as np
import cairosvg
from PIL import Image, ImageDraw, ImageFont
import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
PCB = os.path.join(HERE, "NadiSense_ring_v2_revB.kicad_pcb")
SCH = os.path.join(HERE, "NadiSense_ring_v2_revB.kicad_sch")
TMP = sys.argv[1]
os.makedirs(TMP, exist_ok=True)
FAB = os.path.join(HERE, "fab"); os.makedirs(FAB, exist_ok=True)
IMG = os.path.join(HERE, "images"); os.makedirs(IMG, exist_ok=True)
run = lambda *a: subprocess.run(a, check=True, capture_output=True)
sys.path.insert(0, HERE)
import design as D

# ---------------------------------------------------------------- fab files
for f in glob.glob(os.path.join(FAB, "*")):
    os.remove(f)
run("kicad-cli", "pcb", "export", "gerbers", "-l",
    "F.Cu,B.Cu,F.Paste,B.Paste,F.SilkS,B.SilkS,F.Mask,B.Mask,Edge.Cuts,User.1", "--subtract-soldermask", "-o", FAB + "/", PCB)
run("kicad-cli", "pcb", "export", "drill", "--format", "excellon", "--excellon-separate-th", "--generate-map",
    "--map-format", "pdf", "-o", FAB + "/", PCB)
run("kicad-cli", "pcb", "export", "pos", "--side", "both", "--format", "csv", "--units", "mm",
    "-o", os.path.join(FAB, "NadiSense_ring_v2_revB-pos.csv"), PCB)
b = pcbnew.LoadBoard(PCB)
rows = {}
for fp in b.GetFootprints():
    ref = fp.GetReference()
    key = (fp.GetValue() if ref not in D.DNP else "DNP", fp.GetFPID().GetUniStringLibId(),
           "Bottom" if fp.IsFlipped() else "Top")
    rows.setdefault(key, []).append(ref)
order = lambda r: (r.rstrip("0123456789"), int("0" + "".join(c for c in r if c.isdigit())))
with open(os.path.join(FAB, "NadiSense_ring_v2_revB-BOM.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["Qty", "References", "Value", "Footprint", "Side", "Note"])
    for (v, fpid, side), refs in sorted(rows.items(), key=lambda kv: order(sorted(kv[1], key=order)[0])):
        refs = sorted(refs, key=order)
        note = "; ".join(f"{r}: {D.NOTES[r]}" for r in refs if r in D.NOTES)
        w.writerow([0 if v == "DNP" else len(refs), " ".join(refs), v, fpid, side, note])
zp = os.path.join(HERE, "NadiSense_ring_v2_revB_gerbers.zip")
with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(glob.glob(os.path.join(FAB, "*"))):
        z.write(f, os.path.basename(f))
run("kicad-cli", "pcb", "export", "pdf", "-l", "F.Cu,F.Mask,F.Fab,Edge.Cuts,User.1", "--include-border-title",
    "-o", os.path.join(HERE, "NadiSense_ring_v2_revB_top.pdf"), PCB)
run("kicad-cli", "pcb", "export", "pdf", "-l", "B.Cu,B.Mask,B.Fab,B.SilkS,Edge.Cuts,User.1", "--mirror", "--include-border-title",
    "-o", os.path.join(HERE, "NadiSense_ring_v2_revB_bottom.pdf"), PCB)
run("kicad-cli", "sch", "export", "pdf", "-o", os.path.join(HERE, "NadiSense_ring_v2_revB_schematic.pdf"), SCH)

# ---------------------------------------------------------------- layer images
WPX = 6000
layers = ["F.Cu", "B.Cu", "F.SilkS", "B.SilkS", "Edge.Cuts", "F.Mask", "B.Mask", "F.Fab", "User.1"]
M = {}
for lay in layers:
    svg = os.path.join(TMP, lay + ".svg")
    run("kicad-cli", "pcb", "export", "svg", "-l", lay + ",Edge.Cuts", "--exclude-drawing-sheet", "--page-size-mode", "2",
        "--black-and-white", "-o", svg, PCB)
    png = svg[:-4] + ".png"
    cairosvg.svg2png(url=svg, write_to=png, output_width=WPX, background_color="white")
    M[lay] = 1 - np.array(Image.open(png).convert("L")).astype(float) / 255
h, w = M["F.Cu"].shape
edge = M["Edge.Cuts"] > 0.3
inside = np.zeros_like(edge)
for y in range(h):
    xs = np.where(edge[y])[0]
    if len(xs) > 1:
        inside[y, xs.min():xs.max() + 1] = True
ys, xs = np.where(edge)
box = (xs.min() - 6, ys.min() - 6, xs.max() + 7, ys.max() + 7)
px_per_mm = (box[2] - box[0] - 13) / 66.8


def comp(spec, bg):
    img = np.ones((h, w, 3)) * np.array(bg, float)
    for mask, col, a in spec:
        a = np.clip(mask, 0, 1)[..., None] * a
        img = img * (1 - a) + np.array(col, float) * a
    return Image.fromarray(img.astype(np.uint8)).crop(box)


onlyF = M["F.Cu"] * (1 - M["Edge.Cuts"])
onlyB = M["B.Cu"] * (1 - M["Edge.Cuts"])
kicad = comp([(inside * 1.0, (12, 22, 36), 1), (M["User.1"] * (1 - M["Edge.Cuts"]), (90, 90, 120), 0.6),
              (onlyB, (60, 105, 230), 0.85), (onlyF, (210, 60, 60), 0.85),
              (M["F.SilkS"] * (1 - M["Edge.Cuts"]), (240, 240, 240), 1), (M["Edge.Cuts"], (235, 210, 70), 1)], (12, 22, 36))
top = comp([(inside * 1.0, (196, 104, 30), 1), (onlyB * inside, (150, 78, 22), 0.28), (onlyF, (228, 148, 66), 0.95),
            (M["F.Mask"] * onlyF, (238, 198, 94), 1), (M["F.SilkS"] * (1 - M["Edge.Cuts"]), (250, 250, 246), 1)], (255, 255, 255))
bot = comp([(inside * 1.0, (196, 104, 30), 1), (onlyF * inside, (150, 78, 22), 0.28), (onlyB, (228, 148, 66), 0.95),
            (M["B.Mask"] * onlyB, (238, 198, 94), 1), (M["B.SilkS"] * (1 - M["Edge.Cuts"]), (250, 250, 246), 1),
            (M["User.1"] * (1 - M["Edge.Cuts"]) * inside, (40, 40, 40), 0.5)], (255, 255, 255)).transpose(Image.FLIP_LEFT_RIGHT)
fab = comp([(inside * 1.0, (252, 249, 240), 1), (onlyF, (238, 190, 120), 0.7), (M["F.Fab"] * (1 - M["Edge.Cuts"]), (25, 25, 30), 1),
            (M["Edge.Cuts"], (60, 60, 60), 1)], (255, 255, 255))
for n, im in (("pcb_layers", kicad), ("pcb_top", top), ("pcb_bottom", bot), ("pcb_assembly", fab)):
    im.save(os.path.join(IMG, n + ".png"))
print("images", kicad.size, "px/mm %.1f" % px_per_mm)

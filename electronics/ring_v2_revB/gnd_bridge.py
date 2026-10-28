"""Join isolated GND copper islands (pour fragments + their vias/pads) to the main ground with A* tracks/vias."""
import sys, re
import numpy as np
from PIL import Image, ImageDraw
import pcbnew
sys.argv = [sys.argv[0], sys.argv[1]]
import finish2 as F2
exec(open("fix_islands.py").read().split("trk = [(t.GetNetname(), t) for t in b.GetTracks()]")[0].replace("b = pcbnew.LoadBoard(pcb)", "b = F2.b"))
b = F2.b
frags, vias, pads = snapshot()
comps = components(frags, vias, pads)


def mask(comp):
    out = {}
    for lay in F2.LAY:
        im = Image.new("L", (F2.nx, F2.ny), 0); d = ImageDraw.Draw(im)
        for i in comp:
            if frags[i][0] == lay:
                pts = [F2.g(x, y) for x, y in frags[i][1].vertices]
                d.polygon(pts, fill=255)
        out[lay] = np.array(im) > 0
    return out


main = mask(comps[0])
for comp in comps[1:]:
    has_items = any(frags[i][1].contains_point((x, y)) for i in comp for x, y, r in vias) or \
                any(frags[i][1].contains_point((x, y)) for i in comp for x, y, f_, b_ in pads)
    if not has_items:
        continue                      # dead fragment, removed by the pour's island removal
    isl = mask(comp)
    c = frags[comp[0]][1].vertices.mean(0)
    print(f"island near ({c[0] - 100:.1f}, {c[1] - 100:.1f}):", end=" ")
    F2.route("GND", masks=(isl, main))
pcbnew.ZONE_FILLER(b).Fill(b.Zones())
b.Save(sys.argv[1])

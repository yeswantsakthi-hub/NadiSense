"""Compare the KiCad-exported netlist with design.py: every intended connection present, nothing merged."""
import re, sys
import design as D
src = open("NadiSense_ring_v2_revB.net").read()
got = {}
for name, body in re.findall(r'\(net \(code "\d+"\) \(name "([^"]*)"\)(.*?)\)\s*(?=\(net |\)\s*\)\s*$)', src, re.S):
    for ref, pin in re.findall(r'\(node \(ref "([^"]+)"\) \(pin "([^"]+)"\)', body):
        got[(ref, pin)] = name.lstrip("/")
fps = dict(re.findall(r'\(comp \(ref "([^"]+)"\).*?\(footprint "([^"]*)"\)', src, re.S))
want = {}
for ref, (_, _, fp, nets) in D.PARTS.items():
    if fps.get(ref) != fp:
        print("FOOTPRINT", ref, fps.get(ref), "!=", fp)
    for pin, net in nets.items():
        want[(ref, pin)] = net
bad = 0
groups = {}
for k, n in want.items():
    g = got.get(k)
    if g is None:
        print("MISSING pin", k, "->", n); bad += 1
    else:
        groups.setdefault(n, set()).add(g)
for n, gs in groups.items():
    if len(gs) != 1:
        print("SPLIT net", n, gs); bad += 1
inv = {}
for n, gs in groups.items():
    for g in gs:
        inv.setdefault(g, set()).add(n)
for g, ns in inv.items():
    if len(ns) > 1:
        print("MERGED", g, ns); bad += 1
extra = [k for k, n in got.items() if k not in want and not n.startswith("unconnected")]
for k in extra:
    print("EXTRA connection", k, got[k]); bad += 1
print("pins checked", len(want), "nets", len(groups), "problems", bad)
sys.exit(1 if bad else 0)

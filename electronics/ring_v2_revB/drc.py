import sys, pcbnew
b = pcbnew.LoadBoard(sys.argv[1])
ok = pcbnew.WriteDRCReport(b, sys.argv[2], pcbnew.EDA_UNITS_MILLIMETRES, True)
print("drc written", ok)

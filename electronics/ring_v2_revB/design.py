"""NadiSense ring v2, Rev B: single source of truth for parts, pin maps and nets.

Pin maps come from the manufacturers' documents:
  nRF52840-CKAA WLCSP-94   Nordic nRF52840 Product Specification, "Pin assignments - WLCSP"
  MAX86141 WLP-20          Analog Devices MAX86140/MAX86141 data sheet, bump configuration
  BQ25120A YFP DSBGA-25    TI BQ25120A data sheet, Pin Configuration and Functions
  LIS2DW12 LGA-12          ST LIS2DW12 data sheet, pin description
  TMP117 DRV WSON-6        TI TMP117 data sheet, Pin Functions
Power architecture (Rev B): BQ25120A buck SYS output = +1V8 rail. nRF52840 runs in normal-voltage
mode (VDD = VDDH = 1.8 V, internal LDOs), so every IC sits on one 1.8 V rail; LEDs run from VBAT.
"""

# ------------------------------------------------------------------ nRF52840 WLCSP-94 ball map
NRF_BALLS = {
    "A1": "XC1", "A2": "XC2", "A3": "P1.11", "A4": "P1.13", "A5": "P0.03", "A6": "P0.28", "A7": "P0.30",
    "A8": "DEC4", "A9": "DCC", "A10": "DEC1",
    "B3": "VDD", "B4": "P1.10", "B5": "P1.14", "B6": "P0.02", "B7": "VSS", "B8": "VDD", "B9": "P0.00/XL1",
    "B10": "P0.01/XL2",
    "C1": "VSS_PA", "C2": "DEC6", "C4": "VSS", "C5": "P1.12", "C6": "P1.15", "C7": "P0.29", "C8": "P0.31",
    "C9": "P0.26", "C10": "P0.04",
    "D3": "VSS", "D4": "VSS", "D5": "VSS", "D6": "VSS", "D7": "VSS", "D8": "VSS", "D9": "P0.27", "D10": "P0.05",
    "E1": "ANT", "E2": "P0.10/NFC2", "E3": "P1.06", "E4": "VSS", "E5": "VSS", "E6": "VSS", "E7": "VSS",
    "E8": "VSS", "E9": "P0.06", "E10": "P0.08",
    "F1": "P0.09/NFC1", "F2": "DEC5", "F3": "P1.03", "F4": "VSS", "F5": "VSS", "F6": "VSS", "F7": "VSS",
    "F8": "VSS", "F9": "P0.07", "F10": "P1.09",
    "G1": "P1.07", "G2": "P1.05", "G3": "P1.02", "G4": "VSS", "G5": "VSS", "G6": "VSS", "G7": "VSS",
    "G8": "VSS", "G9": "P1.08", "G10": "P0.12",
    "H1": "P1.04", "H2": "SWDCLK", "H4": "P0.24", "H5": "P0.23", "H6": "P0.16", "H7": "P0.13", "H8": "P0.11",
    "H9": "DCCH", "H10": "VDD",
    "J1": "P1.01", "J2": "SWDIO", "J3": "P1.00", "J4": "P0.21", "J5": "P0.20", "J6": "P0.17", "J7": "P0.14",
    "J8": "D-", "J9": "VBUS", "J10": "VDDH",
    "K1": "VDD", "K2": "P0.25", "K3": "P0.22", "K4": "P0.19", "K5": "VDD", "K6": "P0.18/nRESET", "K7": "P0.15",
    "K8": "D+", "K9": "DECUSB", "K10": "VSS",
}
assert len(NRF_BALLS) == 94
# signals placed on outer-ring balls where possible so they escape without via-in-pad
NRF_NETS = {
    "A1": "XC1", "A2": "XC2", "A8": "DEC4", "A10": "DEC1", "C2": "DEC6", "E1": "RF_ANT",
    "C10": "SPI_SCK", "D10": "SPI_MOSI", "E10": "SPI_MISO", "F10": "AFE_CS", "G10": "AFE_INT",
    "B10": "I2C_SDA", "K7": "I2C_SCL", "A6": "ACC_INT", "K3": "TEMP_ALRT", "K2": "CHG_INT", "A7": "CHG_CD",
    "K6": "nRESET", "H2": "SWDCLK", "J2": "SWDIO", "J10": "+1V8", "C1": "GND",
    "C7": "GND",   # unused P0.29 tied to GND: bridges the fenced-in VSS ball B7 to the inner ground
}
for b, n in NRF_BALLS.items():
    if n == "VDD":
        NRF_NETS[b] = "+1V8"
    if n == "VSS":
        NRF_NETS[b] = "GND"

# ------------------------------------------------------------------ MAX86141 WLP-20 (rows A-D, cols 1-5)
MAX_BUMPS = {
    "A1": "VLED", "A2": "SCLK", "A3": "SDO", "A4": "SDI", "A5": "CSB",
    "B1": "LED3_DRV", "B2": "INT", "B3": "GPIO1", "B4": "GPIO2", "B5": "VREF",
    "C1": "LED2_DRV", "C2": "VDD_DIG", "C3": "GND_DIG", "C4": "GND_ANA", "C5": "PD_GND",
    "D1": "LED1_DRV", "D2": "VDD_ANA", "D3": "PGND", "D4": "PD2_IN", "D5": "PD1_IN",
}
MAX_NETS = {"A1": "VBAT", "A2": "SPI_SCK", "A3": "SPI_MISO", "A4": "SPI_MOSI", "A5": "AFE_CS", "B2": "AFE_INT",
            "B5": "AFE_VREF", "C1": "LED_IR_K", "C2": "+1V8", "C3": "GND", "C4": "GND", "C5": "PD_A",
            "D1": "LED_RED_K", "D2": "+1V8", "D3": "GND", "D5": "PD_K"}

# ------------------------------------------------------------------ BQ25120A DSBGA-25 (top view)
BQ_BALLS = {
    "A1": "GND", "A2": "IN", "A3": "PMID", "A4": "SW", "A5": "PGND",
    "B1": "BAT", "B2": "BAT", "B3": "PMID", "B4": "VINLS", "B5": "SYS",
    "C1": "ISET", "C2": "ILIM", "C3": "TS", "C4": "VINLS", "C5": "LS/LDO",
    "D1": "IPRETERM", "D2": "INT", "D3": "RESET", "D4": "PG", "D5": "GND",
    "E1": "MR", "E2": "CD", "E3": "LSCTRL", "E4": "SDA", "E5": "SCL",
}
BQ_NETS = {"A1": "GND", "A2": "VIN", "A3": "PMID", "B3": "PMID", "A4": "SW", "A5": "GND", "B1": "VBAT", "B2": "VBAT",
           "B4": "+1V8", "C4": "+1V8", "B5": "+1V8", "C1": "ISET", "C2": "GND", "C3": "TS", "C5": "LDO_OUT",
           "D1": "IPRETERM", "D2": "CHG_INT", "D3": "nRESET", "D5": "GND", "E1": "MR", "E2": "CHG_CD", "E3": "GND",
           "E4": "I2C_SDA", "E5": "I2C_SCL"}

# ------------------------------------------------------------------ LIS2DW12 LGA-12
LIS_PINS = {"1": "SCL/SPC", "2": "CS", "3": "SDO/SA0", "4": "SDA/SDI", "5": "NC", "6": "GND", "7": "RES",
            "8": "GND", "9": "VDD", "10": "VDD_IO", "11": "INT2", "12": "INT1"}
LIS_NETS = {"1": "I2C_SCL", "2": "+1V8", "3": "GND", "4": "I2C_SDA", "6": "GND", "7": "GND", "8": "GND",
            "9": "+1V8", "10": "+1V8", "12": "ACC_INT"}

# ------------------------------------------------------------------ TMP117 DRV WSON-6 (+ thermal pad 7)
TMP_PINS = {"1": "SCL", "2": "GND", "3": "ALERT", "4": "ADD0", "5": "V+", "6": "SDA", "7": "EP"}
TMP_NETS = {"1": "I2C_SCL", "2": "GND", "3": "TEMP_ALRT", "4": "GND", "5": "+1V8", "6": "I2C_SDA", "7": "GND"}

FP = "NadiSense"
# ref: (symbol lib_id or custom key, value, footprint, {pin: net}, note)
PARTS = {
    "U1": ("nRF52840", "nRF52840-CKAA", f"{FP}:Nordic_WLCSP-94_3.544x3.607mm_P0.35mm", NRF_NETS),
    "U2": ("MAX86141", "MAX86141ENP+", f"{FP}:Maxim_WLP-20_2.048x1.848mm_Layout5x4_P0.4mm", MAX_NETS),
    "U3": ("TMP117", "TMP117AIDRVR", "Package_SON:WSON-6-1EP_2x2mm_P0.65mm_EP1x1.6mm", TMP_NETS),
    "U4": ("LIS2DW12", "LIS2DW12TR", "Package_LGA:LGA-12_2x2mm_P0.5mm", LIS_NETS),
    "U5": ("BQ25120A", "BQ25120AYFPR", f"{FP}:TI_DSBGA-25_2.5x2.5mm_Layout5x5_P0.5mm", BQ_NETS),
    # nRF52840 support (normal-voltage mode, internal LDOs)
    "C1": ("Device:C", "100nF", "C0201", {"1": "DEC1", "2": "GND"}),
    "C2": ("Device:C", "1.0uF", "C0402", {"1": "DEC4", "2": "GND"}),
    "C3": ("Device:C", "47nF", "C0201", {"1": "DEC6", "2": "GND"}),
    "C4": ("Device:C", "4.7uF", "C0402", {"1": "+1V8", "2": "GND"}),
    "C5": ("Device:C", "100nF", "C0201", {"1": "+1V8", "2": "GND"}),
    "C6": ("Device:C", "12pF", "C0201", {"1": "XC1", "2": "GND"}),
    "C7": ("Device:C", "12pF", "C0201", {"1": "XC2", "2": "GND"}),
    "Y1": ("Device:Crystal_GND24", "32MHz 8pF", "Crystal:Crystal_SMD_2016-4Pin_2.0x1.6mm",
           {"1": "XC1", "2": "GND", "3": "XC2", "4": "GND"}),
    # RF: pi match between ANT and the chip antenna (start values, tune on a VNA)
    "C8": ("Device:C", "0.8pF", "C0201", {"1": "RF_ANT", "2": "GND"}),
    "L2": ("Device:L", "3.9nH", "L0201", {"1": "RF_ANT", "2": "ANT_FEED"}),
    "C9": ("Device:C", "DNP", "C0201", {"1": "ANT_FEED", "2": "GND"}),
    "AE1": ("Antenna", "2450AT18A100", "RF_Antenna:Johanson_2450AT18x100", {"1": "ANT_FEED"}),
    # MAX86141 support
    "C10": ("Device:C", "100nF", "C0201", {"1": "+1V8", "2": "GND"}),       # VDD_ANA
    "C11": ("Device:C", "10uF", "C0402", {"1": "+1V8", "2": "GND"}),        # VDD_ANA bulk
    "C12": ("Device:C", "100nF", "C0201", {"1": "+1V8", "2": "GND"}),       # VDD_DIG
    "C13": ("Device:C", "1.0uF", "C0201", {"1": "AFE_VREF", "2": "GND"}),   # VREF
    "C14": ("Device:C", "10uF", "C0402", {"1": "VBAT", "2": "GND"}),        # VLED
    "D1": ("Device:LED", "Red 660nm", "LED_SMD:LED_0603_1608Metric", {"1": "LED_RED_K", "2": "VBAT"}),
    "D2": ("Device:LED", "IR 880nm", "LED_SMD:LED_0603_1608Metric", {"1": "LED_IR_K", "2": "VBAT"}),
    "D3": ("Device:D_Photo", "Si PIN PD 2x2mm", f"{FP}:PD_2x2mm", {"1": "PD_K", "2": "PD_A"}),
    # sensors
    "C15": ("Device:C", "100nF", "C0201", {"1": "+1V8", "2": "GND"}),       # TMP117
    "C16": ("Device:C", "100nF", "C0201", {"1": "+1V8", "2": "GND"}),       # LIS2DW12 VDD
    "C17": ("Device:C", "100nF", "C0201", {"1": "+1V8", "2": "GND"}),       # LIS2DW12 VDD_IO
    "R1": ("Device:R", "4.7k", "R0201", {"1": "+1V8", "2": "I2C_SDA"}),
    "R2": ("Device:R", "4.7k", "R0201", {"1": "+1V8", "2": "I2C_SCL"}),
    "R3": ("Device:R", "10k", "R0201", {"1": "+1V8", "2": "TEMP_ALRT"}),
    # charger / power
    "C18": ("Device:C", "1.0uF", "C0402", {"1": "VIN", "2": "GND"}),
    "C19": ("Device:C", "4.7uF", "C0402", {"1": "PMID", "2": "GND"}),
    "C20": ("Device:C", "10uF", "C0402", {"1": "+1V8", "2": "GND"}),         # SYS
    "C21": ("Device:C", "1.0uF", "C0402", {"1": "VBAT", "2": "GND"}),
    "C22": ("Device:C", "1.0uF", "C0201", {"1": "+1V8", "2": "GND"}),        # VINLS
    "C23": ("Device:C", "1.0uF", "C0201", {"1": "LDO_OUT", "2": "GND"}),     # LS/LDO (disabled, LSCTRL low)
    "L1": ("Device:L", "2.2uH", "Inductor_SMD:L_0603_1608Metric", {"1": "SW", "2": "+1V8"}),
    "R4": ("Device:R", "R_ISET", "R0201", {"1": "ISET", "2": "GND"}),
    "R5": ("Device:R", "R_IPRETERM", "R0201", {"1": "IPRETERM", "2": "GND"}),
    "R6": ("Device:R", "10k", "R0201", {"1": "TS", "2": "GND"}),
    "J1": ("Connector_Generic:Conn_01x02", "Charge pads", f"{FP}:ChargePads_2xD1.2mm", {"1": "GND", "2": "VIN"}),
    "BT1": ("Device:Battery_Cell", "Li-Po 3.7V 12mAh", f"{FP}:LiPo_Tabs_1.6x1.9mm", {"1": "VBAT", "2": "GND"}),
    # programming / test pads (bottom side)
    "TP1": ("Connector:TestPoint", "SWDIO", f"{FP}:TestPad_D0.8mm", {"1": "SWDIO"}),
    "TP2": ("Connector:TestPoint", "SWDCLK", f"{FP}:TestPad_D0.8mm", {"1": "SWDCLK"}),
    "TP3": ("Connector:TestPoint", "nRESET", f"{FP}:TestPad_D0.8mm", {"1": "nRESET"}),
    "TP4": ("Connector:TestPoint", "+1V8", f"{FP}:TestPad_D0.8mm", {"1": "+1V8"}),
    "TP5": ("Connector:TestPoint", "GND", f"{FP}:TestPad_D0.8mm", {"1": "GND"}),
    "TP6": ("Connector:TestPoint", "MR", f"{FP}:TestPad_D0.8mm", {"1": "MR"}),
}
SHORT_FP = {"C0201": "Capacitor_SMD:C_0201_0603Metric", "C0402": "Capacitor_SMD:C_0402_1005Metric",
            "R0201": "Resistor_SMD:R_0201_0603Metric", "L0201": "Inductor_SMD:L_0201_0603Metric"}
for k, (s, v, fp, nets) in list(PARTS.items()):
    PARTS[k] = (s, v, SHORT_FP.get(fp, fp), nets)

DNP = {"C9"}
NOTES = {
    "R4": "fast-charge current set resistor; value per TI BQ25120A data sheet (ISET), charge current is also set over I2C",
    "R5": "pre-charge/termination resistor; value per TI data sheet (IPRETERM)",
    "R6": "TS: 10k emulates a 10k NTC at 25 C (cell has no NTC); TS can be disabled over I2C",
    "C8": "RF pi-match start value - tune with a VNA in the finished ring",
    "L2": "RF pi-match start value - tune with a VNA in the finished ring",
}


def all_nets():
    out = {}
    for ref, (_, _, _, nets) in PARTS.items():
        for pin, net in nets.items():
            out.setdefault(net, []).append((ref, pin))
    return out


if __name__ == "__main__":
    n = all_nets()
    for k in sorted(n):
        print(f"{k:12s} {len(n[k]):3d}  {' '.join(r + '.' + p for r, p in n[k][:12])}")
    single = [k for k, v in n.items() if len(v) < 2]
    print("single-pin nets:", single)

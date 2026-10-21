"""NadiSense ring v2 power budget (average current, µA).

Datasheet anchors:
  MAX86141: 11 µA IDD per single LED exposure at 25 sps (LP_BOOST); VLED 1240 µA for two exposures
            at 84 sps with 62 mA LED current (scaled linearly below).
  nRF52840: ~3 µA System ON idle with RTC; ~3.3 mA CPU active.
  LIS2DW12 ~1 µA low-power mode; BQ25120A ~1 µA quiescent; TMP117 3.5 µA at 1 Hz -> 1/min.
"""
import json, sys

def budget(led_mA=10.0, cpu_ms=3.0, cell_mAh=12.0, usable=0.8):
    led_scale = (led_mA / 62.0) * (25 / 84)
    night = {
        "AFE red+IR, 25 sps": 2 * 11.0,
        "LED drive (red+IR)": 1240.0 * led_scale,
        "MCU beat processing": 3300.0 * cpu_ms / 1000.0,
    }
    day_duty = 0.10  # 60 s spot check every 10 min
    day = {
        "AFE IR spot check": 11.0 * day_duty,
        "LED drive (IR)": 620.0 * led_scale * day_duty,
        "MCU processing": 3300.0 * cpu_ms / 1000.0 * day_duty,
    }
    base = {"nRF52840 idle + RTC": 3.0, "Accelerometer": 1.0, "Charger Iq": 1.0,
            "BLE daily sync": 1.4, "Temperature (1/min)": 0.2}
    b = sum(base.values())
    n = sum(night.values()) + b
    d = sum(day.values()) + b
    avg = (8 * n + 16 * d) / 24
    days = cell_mAh * usable / (avg / 1000.0) / 24
    return dict(night_uA=round(n, 1), day_uA=round(d, 1), avg_uA=round(avg, 1), life_days=round(days, 1),
                night=night, day=day, base=base)

nominal = budget()
worst = budget(led_mA=20.0, cpu_ms=6.0)
print(json.dumps({"nominal": nominal, "worst": worst}, indent=1))

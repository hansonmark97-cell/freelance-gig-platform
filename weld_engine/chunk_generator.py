"""
WeldScan 3D — Chunk Generator

Converts simplified contour segments into a labelled "cut list" (P1–Pn),
computing miter angles and kerf-adjusted lengths ready for shop use.
"""

import math
from typing import Optional


def angle_between(
    A: tuple[float, float],
    B: tuple[float, float],
    C: tuple[float, float],
) -> float:
    """
    Interior angle at vertex B formed by vectors BA and BC (degrees).
    """
    bax, bay = A[0] - B[0], A[1] - B[1]
    bcx, bcy = C[0] - B[0], C[1] - B[1]
    dot = bax * bcx + bay * bcy
    mag_ba = math.hypot(bax, bay)
    mag_bc = math.hypot(bcx, bcy)
    if mag_ba == 0 or mag_bc == 0:
        return 0.0
    cos_theta = max(-1.0, min(1.0, dot / (mag_ba * mag_bc)))
    return math.degrees(math.acos(cos_theta))


def miter_angle(interior_deg: float) -> float:
    """Chop-saw miter angle = (180 - interior) / 2."""
    return (180.0 - interior_deg) / 2.0


def kerf_adjusted_length(nominal_mm: float, kerf_mm: float) -> float:
    """Subtract the kerf width from the nominal cut length."""
    return nominal_mm - kerf_mm


def generate_cut_list(
    segments: list[dict],
    ppi: float,
    kerf_mm: float = 0.0,
    unit: str = "inches",
) -> list[dict]:
    """
    Build the full labelled cut list from contour segments.

    Args:
        segments:  list of {lengthPx, startPoint:{x,y}, endPoint:{x,y}}
        ppi:       pixels-per-inch calibration constant
        kerf_mm:   kerf width in mm (0 = no adjustment)
        unit:      "inches" or "mm" for the primary display unit

    Returns:
        List of chunk dicts:
            label, lengthIn, lengthMm, miterDeg, kerfAdjLengthMm
    """
    n = len(segments)
    cut_list = []

    for i, seg in enumerate(segments):
        length_in = seg["lengthPx"] / ppi
        length_mm = length_in * 25.4

        # Compute miter angle using neighbouring segment endpoints
        miter_deg = 0.0
        if n >= 3:
            prev_seg = segments[(i - 1) % n]
            next_seg = segments[(i + 1) % n]
            A = (prev_seg["endPoint"]["x"], prev_seg["endPoint"]["y"])
            B = (seg["startPoint"]["x"], seg["startPoint"]["y"])
            C = (next_seg["startPoint"]["x"], next_seg["startPoint"]["y"])
            interior = angle_between(A, B, C)
            miter_deg = miter_angle(interior)

        kerf_adj_mm = kerf_adjusted_length(length_mm, kerf_mm)

        cut_list.append({
            "label": f"P{i + 1}",
            "lengthIn": round(length_in, 3),
            "lengthMm": round(length_mm, 2),
            "miterDeg": round(miter_deg, 1),
            "kerfAdjLengthMm": round(kerf_adj_mm, 2),
        })

    return cut_list

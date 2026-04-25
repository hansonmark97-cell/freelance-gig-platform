"""
WeldScan 3D — Welder-Specific Math Calculators

Pure-Python implementations of the welding math formulas.
These functions have no OpenCV dependency and can be unit-tested standalone.
"""

import math


def bend_deduction(inside_radius_mm: float, thickness_mm: float) -> float:
    """
    Bend deduction (BD) — flat material consumed by a bend.

    Formula: BD = (π/2) × (inside_radius + thickness / 3)

    Args:
        inside_radius_mm: inside bend radius in mm
        thickness_mm:     metal thickness in mm

    Returns:
        Bend deduction in mm
    """
    if inside_radius_mm < 0:
        raise ValueError("inside_radius_mm must be non-negative")
    if thickness_mm <= 0:
        raise ValueError("thickness_mm must be positive")
    return (math.pi / 2) * (inside_radius_mm + thickness_mm / 3)


def bevel_gap(wire_diameter_mm: float, thickness_mm: float) -> dict:
    """
    Bevel and root-gap calculator (AWS D1.1 rule of thumb).

    Args:
        wire_diameter_mm: electrode/wire diameter in mm
        thickness_mm:     metal thickness in mm

    Returns:
        dict: {root_gap_mm, landing_mm}
    """
    if wire_diameter_mm <= 0:
        raise ValueError("wire_diameter_mm must be positive")
    if thickness_mm <= 0:
        raise ValueError("thickness_mm must be positive")
    root_gap_mm = wire_diameter_mm
    landing_mm = max(1.0, thickness_mm * 0.1)
    return {"root_gap_mm": round(root_gap_mm, 2), "landing_mm": round(landing_mm, 2)}


def fillet_cross_section(leg_mm: float) -> float:
    """
    Cross-section area of an equal-leg fillet weld.

    A = 0.5 × leg²

    Args:
        leg_mm: fillet leg size in mm

    Returns:
        Cross-section area in mm²
    """
    if leg_mm <= 0:
        raise ValueError("leg_mm must be positive")
    return 0.5 * leg_mm * leg_mm


def weld_volume(cross_section_mm2: float, weld_length_mm: float) -> dict:
    """
    Estimate weld volume for wire/gas consumption calculations.

    V = cross_section_area × weld_length

    Args:
        cross_section_mm2: weld cross-section area in mm²
        weld_length_mm:    total weld run length in mm

    Returns:
        dict: {volume_mm3, volume_cm3, volume_in3}
    """
    if cross_section_mm2 <= 0:
        raise ValueError("cross_section_mm2 must be positive")
    if weld_length_mm <= 0:
        raise ValueError("weld_length_mm must be positive")
    volume_mm3 = cross_section_mm2 * weld_length_mm
    volume_cm3 = volume_mm3 / 1000.0
    volume_in3 = volume_mm3 / 16387.064
    return {
        "volume_mm3": round(volume_mm3, 4),
        "volume_cm3": round(volume_cm3, 4),
        "volume_in3": round(volume_in3, 4),
    }

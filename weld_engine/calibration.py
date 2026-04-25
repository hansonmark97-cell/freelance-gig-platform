"""
WeldScan 3D — Reference-Object Calibration Module

Detects the reference object (e.g., a 12-inch square or dollar bill) in a
photograph and computes the pixels-per-inch (PPI) calibration constant.
"""

import cv2
import numpy as np


def find_largest_rectangle(image: np.ndarray) -> tuple[np.ndarray | None, float]:
    """
    Locate the largest rectangular contour in the image (the reference object).

    Returns:
        contour: the 4-point contour (or None if not found)
        pixel_length: the longer edge length in pixels
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, 0.0

    best_contour = None
    best_area = 0.0

    for cnt in contours:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        area = cv2.contourArea(cnt)
        if len(approx) == 4 and area > best_area:
            best_area = area
            best_contour = approx

    if best_contour is None:
        return None, 0.0

    # Measure the longer edge of the rectangle
    pts = best_contour.reshape(4, 2).astype(np.float32)
    edge_lengths = [
        np.linalg.norm(pts[i] - pts[(i + 1) % 4]) for i in range(4)
    ]
    pixel_length = max(edge_lengths)
    return best_contour, pixel_length


def compute_ppi(ref_pixel_length: float, ref_real_inches: float) -> float:
    """
    Compute pixels-per-inch from a measured reference object.

    Args:
        ref_pixel_length: measured length of the reference in pixels
        ref_real_inches:  known real-world length in inches

    Returns:
        PPI calibration constant
    """
    if ref_pixel_length <= 0:
        raise ValueError("ref_pixel_length must be positive")
    if ref_real_inches <= 0:
        raise ValueError("ref_real_inches must be positive")
    return ref_pixel_length / ref_real_inches


def calibrate_from_image(image: np.ndarray, ref_real_inches: float) -> dict:
    """
    Full calibration pipeline: detect the reference rectangle and return PPI.

    Args:
        image:           BGR image (numpy array from cv2.imread)
        ref_real_inches: real-world length of the reference object (inches)

    Returns:
        dict with keys: ppi, ref_pixel_length, contour_points
    """
    contour, pixel_length = find_largest_rectangle(image)
    if contour is None or pixel_length == 0:
        raise RuntimeError(
            "Could not detect a rectangular reference object. "
            "Ensure the reference square/ruler is clearly visible."
        )

    ppi = compute_ppi(pixel_length, ref_real_inches)
    return {
        "ppi": round(ppi, 4),
        "ref_pixel_length": round(pixel_length, 2),
        "contour_points": contour.reshape(-1, 2).tolist(),
    }

"""
WeldScan 3D — Edge & Contour Detection Module

Uses OpenCV Canny edge detection and contour analysis to extract
the outline of the metal part/art piece from a calibrated photograph.
"""

import cv2
import numpy as np


def detect_part_contour(
    image: np.ndarray,
    ref_contour: np.ndarray | None = None,
    canny_low: int = 100,
    canny_high: int = 200,
) -> np.ndarray | None:
    """
    Detect the primary contour of the metal part.

    If ref_contour is provided the reference object's bounding region is
    masked out so it does not interfere with the subject detection.

    Args:
        image:       BGR image
        ref_contour: 4-point contour of the reference object (to exclude)
        canny_low:   lower Canny threshold
        canny_high:  upper Canny threshold

    Returns:
        The largest non-reference contour (numpy array), or None.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Mask out the reference object region
    if ref_contour is not None:
        mask = np.ones(gray.shape, dtype=np.uint8) * 255
        cv2.fillPoly(mask, [ref_contour], 0)
        blurred = cv2.bitwise_and(blurred, blurred, mask=mask)

    edges = cv2.Canny(blurred, canny_low, canny_high)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # Return the largest contour (the main subject)
    return max(contours, key=cv2.contourArea)


def compute_bounding_box(contour: np.ndarray) -> dict:
    """
    Compute the axis-aligned bounding box of a contour.

    Returns:
        dict with x, y, width_px, height_px
    """
    x, y, w, h = cv2.boundingRect(contour)
    return {"x": int(x), "y": int(y), "width_px": int(w), "height_px": int(h)}


def contour_to_segments(contour: np.ndarray, epsilon_factor: float = 0.02) -> list[dict]:
    """
    Simplify a contour into straight-line segments using the
    Ramer-Douglas-Peucker algorithm (cv2.approxPolyDP).

    Args:
        contour:        raw contour from findContours
        epsilon_factor: fraction of arc length used for RDP tolerance

    Returns:
        List of segment dicts: {lengthPx, startPoint:{x,y}, endPoint:{x,y}}
    """
    peri = cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon_factor * peri, True)
    pts = approx.reshape(-1, 2).tolist()

    segments = []
    n = len(pts)
    for i in range(n):
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        length_px = float(np.linalg.norm(np.array(p1) - np.array(p2)))
        segments.append({
            "lengthPx": round(length_px, 2),
            "startPoint": {"x": int(p1[0]), "y": int(p1[1])},
            "endPoint": {"x": int(p2[0]), "y": int(p2[1])},
        })
    return segments


def annotate_image(
    image: np.ndarray,
    segments: list[dict],
    ppi: float,
) -> np.ndarray:
    """
    Draw dimension callouts onto the image for each segment.

    Args:
        image:    BGR image to annotate (will be copied)
        segments: list from contour_to_segments
        ppi:      pixels-per-inch calibration constant

    Returns:
        Annotated BGR image.
    """
    annotated = image.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX

    for i, seg in enumerate(segments):
        p1 = (seg["startPoint"]["x"], seg["startPoint"]["y"])
        p2 = (seg["endPoint"]["x"], seg["endPoint"]["y"])

        # Draw segment line
        cv2.line(annotated, p1, p2, (0, 255, 0), 2)

        # Label midpoint with dimension
        mx = (p1[0] + p2[0]) // 2
        my = (p1[1] + p2[1]) // 2
        length_in = seg["lengthPx"] / ppi
        label = f"P{i + 1}: {length_in:.2f}\""
        cv2.putText(annotated, label, (mx + 4, my - 4), font, 0.5, (0, 200, 255), 1)

    return annotated

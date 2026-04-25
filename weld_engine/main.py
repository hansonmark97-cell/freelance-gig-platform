"""
WeldScan 3D — FastAPI Backend

Endpoints:
    POST /calibrate          → compute PPI from reference object in image
    POST /analyze            → extract contour, compute cut list + welder calcs
    POST /export/pdf         → return PDF blueprint bytes
    POST /export/dxf         → return DXF file string
    POST /payment/intent     → create Stripe PaymentIntent (delegated to Node.js)

Run locally:
    uvicorn main:app --reload --port 8000

Environment variables:
    STRIPE_SECRET_KEY   (optional — payment intent creation)
"""

import base64
import io
import os

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from calibration import calibrate_from_image
from edge_detection import detect_part_contour, compute_bounding_box, contour_to_segments, annotate_image
from chunk_generator import generate_cut_list
from calculators import bend_deduction, bevel_gap, fillet_cross_section, weld_volume
from exporters import generate_pdf_blueprint, generate_dxf

app = FastAPI(title="WeldScan 3D API", version="1.0.0")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CalibrateRequest(BaseModel):
    image_b64: str = Field(..., description="Base64-encoded JPEG/PNG image")
    ref_real_inches: float = Field(..., gt=0, description="Real-world length of reference object (inches)")


class AnalyzeRequest(BaseModel):
    image_b64: str = Field(..., description="Base64-encoded JPEG/PNG image")
    ppi: float = Field(..., gt=0, description="Pixels-per-inch from /calibrate")
    thickness_mm: float = Field(10.0, gt=0)
    kerf_mm: float = Field(0.0, ge=0)
    wire_diameter_mm: float = Field(0.9, gt=0)
    inside_radius_mm: float = Field(10.0, ge=0)
    weld_leg_mm: float = Field(10.0, gt=0)
    epsilon_factor: float = Field(0.02, gt=0, description="RDP simplification tolerance")


class ExportPdfRequest(BaseModel):
    cut_list: list[dict]
    summary: dict
    welder_calcs: dict
    title: str = "WeldScan 3D Blueprint"


class ExportDxfRequest(BaseModel):
    segments: list[dict]
    ppi: float = Field(..., gt=0)
    title: str = "WeldScan 3D"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def decode_image(image_b64: str) -> np.ndarray:
    """Decode a base64-encoded image string into a BGR numpy array."""
    try:
        img_bytes = base64.b64decode(image_b64)
        arr = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image")
        return img
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {exc}") from exc


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/calibrate")
async def calibrate(req: CalibrateRequest):
    """
    Detect the reference object in the image and return the PPI constant.
    """
    image = decode_image(req.image_b64)
    try:
        result = calibrate_from_image(image, req.ref_real_inches)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return result


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Full analysis pipeline: edge detection → chunk generation → welder calcs.
    Returns the annotated image (base64) + cut list + welder calculations.
    """
    image = decode_image(req.image_b64)

    contour = detect_part_contour(image)
    if contour is None:
        raise HTTPException(status_code=422, detail="No part contour detected in image")

    bbox = compute_bounding_box(contour)
    segments = contour_to_segments(contour, epsilon_factor=req.epsilon_factor)
    cut_list = generate_cut_list(segments, req.ppi, kerf_mm=req.kerf_mm)

    total_length_mm = sum(c["lengthMm"] for c in cut_list)
    bd = bend_deduction(req.inside_radius_mm, req.thickness_mm)
    bg = bevel_gap(req.wire_diameter_mm, req.thickness_mm)
    cs = fillet_cross_section(req.weld_leg_mm)
    vol = weld_volume(cs, total_length_mm)

    summary = {
        "totalPieces": len(cut_list),
        "totalLengthMm": round(total_length_mm, 2),
        "bboxWidthIn": round(bbox["width_px"] / req.ppi, 3),
        "bboxHeightIn": round(bbox["height_px"] / req.ppi, 3),
        "bboxWidthMm": round(bbox["width_px"] / req.ppi * 25.4, 2),
        "bboxHeightMm": round(bbox["height_px"] / req.ppi * 25.4, 2),
    }

    welder_calcs = {
        "bendDeductionMm": round(bd, 3),
        "rootGapMm": bg["root_gap_mm"],
        "landingMm": bg["landing_mm"],
        "weldVolumeCm3": vol["volume_cm3"],
        "weldVolumeIn3": vol["volume_in3"],
    }

    # Annotated image
    annotated = annotate_image(image, segments, req.ppi)
    _, enc = cv2.imencode(".jpg", annotated)
    annotated_b64 = base64.b64encode(enc.tobytes()).decode()

    return {
        "cutList": cut_list,
        "summary": summary,
        "welderCalcs": welder_calcs,
        "segments": segments,
        "annotatedImageB64": annotated_b64,
    }


@app.post("/export/pdf", response_class=Response)
async def export_pdf(req: ExportPdfRequest):
    """
    Generate and return a PDF blueprint for the given cut list.
    """
    pdf_bytes = generate_pdf_blueprint(
        req.cut_list, req.summary, req.welder_calcs, title=req.title
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="weldscan_blueprint.pdf"'},
    )


@app.post("/export/dxf", response_class=Response)
async def export_dxf(req: ExportDxfRequest):
    """
    Generate and return a CNC-ready DXF file from contour segments.
    """
    dxf_str = generate_dxf(req.segments, req.ppi, title=req.title)
    return Response(
        content=dxf_str.encode("utf-8"),
        media_type="application/dxf",
        headers={"Content-Disposition": f'attachment; filename="weldscan_cut.dxf"'},
    )

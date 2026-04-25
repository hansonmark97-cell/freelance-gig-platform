const express = require('express');
const Stripe = require('stripe');
const { db } = require('../firebase');
const { authenticate } = require('../middleware/auth');
const { generateId } = require('../utils');
const {
  computePPI,
  pixelsToInches,
  inchesToMm,
  angleBetween,
  miterAngle,
  bendDeduction,
  bevelGap,
  weldVolume,
  filletCrossSection,
  buildCutList,
} = require('../weldscan/calculators');
const { WELDSCAN_PDF_PRICE_USD, WELDSCAN_DXF_PRICE_USD } = require('../constants');

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16',
});

// ---------------------------------------------------------------------------
// POST /api/weldscan/calibrate
// Accept image dimensions of a reference object + its real-world size.
// Returns a PPI calibration value and stores the session.
// ---------------------------------------------------------------------------
router.post('/calibrate', authenticate, async (req, res) => {
  try {
    const { refPixelLength, refRealInches, imageWidth, imageHeight } = req.body;

    if (refPixelLength == null || refRealInches == null) {
      return res.status(400).json({
        error: 'refPixelLength and refRealInches are required',
      });
    }
    if (refPixelLength <= 0 || refRealInches <= 0) {
      return res.status(400).json({
        error: 'refPixelLength and refRealInches must be positive numbers',
      });
    }

    const ppi = computePPI(Number(refPixelLength), Number(refRealInches));
    const sessionId = generateId();
    const createdAt = new Date().toISOString();

    const session = {
      id: sessionId,
      userId: req.user.id,
      ppi,
      refPixelLength: Number(refPixelLength),
      refRealInches: Number(refRealInches),
      imageWidth: imageWidth ? Number(imageWidth) : null,
      imageHeight: imageHeight ? Number(imageHeight) : null,
      status: 'calibrated',
      createdAt,
    };

    await db.collection('weldscan_sessions').doc(sessionId).set(session);

    return res.status(201).json({ sessionId, ppi });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/weldscan/analyze
// Accept a session ID, material parameters, and polygon segments detected
// by the CV pipeline. Returns the full cut list and welder calculations.
// ---------------------------------------------------------------------------
router.post('/analyze', authenticate, async (req, res) => {
  try {
    const {
      sessionId,
      segments,          // [{lengthPx, startPoint, endPoint}] from CV pipeline
      thicknessMm,
      kerfMm,
      wireDiameterMm,
      insideRadiusMm,
      weldLegMm,
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!Array.isArray(segments) || segments.length < 2) {
      return res.status(400).json({ error: 'segments must be an array with at least 2 entries' });
    }

    // Load calibration session
    const sessionDoc = await db.collection('weldscan_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Calibration session not found' });
    }
    const session = sessionDoc.data();
    if (session.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { ppi } = session;
    const thick = thicknessMm ? Number(thicknessMm) : 10;
    const kerf = kerfMm ? Number(kerfMm) : 0;
    const wire = wireDiameterMm ? Number(wireDiameterMm) : 0.9;
    const radius = insideRadiusMm ? Number(insideRadiusMm) : thick;
    const leg = weldLegMm ? Number(weldLegMm) : thick;

    // Compute miter angles from consecutive segment endpoints
    const enrichedSegments = segments.map((seg, i) => {
      let angle = 0;
      if (i > 0 && i < segments.length - 1) {
        const prev = segments[i - 1];
        const curr = segments[i];
        const next = segments[i + 1];
        if (prev.endPoint && curr.endPoint && next.endPoint) {
          const A = prev.endPoint;
          const B = curr.endPoint;
          const C = next.endPoint;
          const interior = angleBetween(A, B, C);
          angle = miterAngle(interior);
        }
      }
      return { lengthPx: Number(seg.lengthPx), angle };
    });

    const cutList = buildCutList(enrichedSegments, ppi, kerf);

    // Welder-specific calculations
    const totalLengthMm = cutList.reduce((sum, p) => sum + p.lengthMm, 0);
    const bd = bendDeduction(radius, thick);
    const { rootGapMm, landingMm } = bevelGap(wire, thick);
    const crossSection = filletCrossSection(leg);
    const volume = weldVolume(crossSection, totalLengthMm);

    const bboxWidthPx = Math.max(...segments.map(s => s.endPoint ? s.endPoint.x : 0)) -
                        Math.min(...segments.map(s => s.endPoint ? s.endPoint.x : 0));
    const bboxHeightPx = Math.max(...segments.map(s => s.endPoint ? s.endPoint.y : 0)) -
                         Math.min(...segments.map(s => s.endPoint ? s.endPoint.y : 0));

    const result = {
      sessionId,
      cutList,
      summary: {
        totalPieces: cutList.length,
        totalLengthMm: +totalLengthMm.toFixed(2),
        bboxWidthIn: +pixelsToInches(bboxWidthPx, ppi).toFixed(3),
        bboxHeightIn: +pixelsToInches(bboxHeightPx, ppi).toFixed(3),
        bboxWidthMm: +inchesToMm(pixelsToInches(bboxWidthPx, ppi)).toFixed(2),
        bboxHeightMm: +inchesToMm(pixelsToInches(bboxHeightPx, ppi)).toFixed(2),
      },
      welderCalcs: {
        bendDeductionMm: +bd.toFixed(3),
        rootGapMm: +rootGapMm.toFixed(2),
        landingMm: +landingMm.toFixed(2),
        weldVolumeCm3: +volume.volumeCm3.toFixed(4),
        weldVolumeIn3: +volume.volumeIn3.toFixed(4),
      },
      exportPrices: {
        pdfUsd: WELDSCAN_PDF_PRICE_USD,
        dxfUsd: WELDSCAN_DXF_PRICE_USD,
      },
    };

    // Persist the analysis so exports can reference it later
    await db.collection('weldscan_sessions').doc(sessionId).update({
      status: 'analyzed',
      analysis: result,
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/weldscan/export/pdf
// Create a Stripe PaymentIntent for a PDF export unlock.
// ---------------------------------------------------------------------------
router.post('/export/pdf', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const sessionDoc = await db.collection('weldscan_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionDoc.data();
    if (session.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (session.status !== 'analyzed') {
      return res.status(400).json({ error: 'Session must be analyzed before export' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(WELDSCAN_PDF_PRICE_USD * 100),
      currency: 'usd',
      metadata: { sessionId, exportType: 'pdf', userId: req.user.id },
    });

    return res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      exportType: 'pdf',
      priceUsd: WELDSCAN_PDF_PRICE_USD,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/weldscan/export/dxf
// Create a Stripe PaymentIntent for a DXF export unlock.
// ---------------------------------------------------------------------------
router.post('/export/dxf', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const sessionDoc = await db.collection('weldscan_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const session = sessionDoc.data();
    if (session.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (session.status !== 'analyzed') {
      return res.status(400).json({ error: 'Session must be analyzed before export' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(WELDSCAN_DXF_PRICE_USD * 100),
      currency: 'usd',
      metadata: { sessionId, exportType: 'dxf', userId: req.user.id },
    });

    return res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      exportType: 'dxf',
      priceUsd: WELDSCAN_DXF_PRICE_USD,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/weldscan/payment/intent
// Generic PaymentIntent creator for any WeldScan export amount.
// ---------------------------------------------------------------------------
router.post('/payment/intent', authenticate, async (req, res) => {
  try {
    const { amountUsd, exportType, sessionId } = req.body;

    if (!amountUsd || amountUsd <= 0) {
      return res.status(400).json({ error: 'amountUsd must be a positive number' });
    }
    if (!exportType || !['pdf', 'dxf', 'pro'].includes(exportType)) {
      return res.status(400).json({ error: "exportType must be 'pdf', 'dxf', or 'pro'" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amountUsd) * 100),
      currency: 'usd',
      metadata: { exportType, sessionId: sessionId || '', userId: req.user.id },
    });

    return res.status(201).json({
      clientSecret: paymentIntent.client_secret,
      amountUsd: Number(amountUsd),
      exportType,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

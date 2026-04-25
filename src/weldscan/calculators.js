/**
 * WeldScan 3D — Welder-Specific Math Calculators
 *
 * Pure JavaScript implementation of the welding math engine.
 * These functions are used by the Express API routes and can also
 * be unit-tested independently of any CV pipeline.
 */

/**
 * Compute the pixels-per-inch (PPI) calibration constant.
 *
 * @param {number} refPixelLength  - Measured length of the reference object in pixels
 * @param {number} refRealInches   - Known real-world length of the reference object (inches)
 * @returns {number} PPI ratio
 */
function computePPI(refPixelLength, refRealInches) {
  if (refPixelLength <= 0) throw new Error('refPixelLength must be positive');
  if (refRealInches <= 0) throw new Error('refRealInches must be positive');
  return refPixelLength / refRealInches;
}

/**
 * Convert a pixel distance to inches using the calibration PPI.
 *
 * @param {number} pixels
 * @param {number} ppi
 * @returns {number} distance in inches
 */
function pixelsToInches(pixels, ppi) {
  if (ppi <= 0) throw new Error('ppi must be positive');
  return pixels / ppi;
}

/**
 * Convert inches to millimetres.
 *
 * @param {number} inches
 * @returns {number}
 */
function inchesToMm(inches) {
  return inches * 25.4;
}

/**
 * Compute the angle (degrees) between two 2-D vectors formed by
 * three consecutive contour points: A → B → C.
 *
 * @param {{x:number, y:number}} A
 * @param {{x:number, y:number}} B  - vertex
 * @param {{x:number, y:number}} C
 * @returns {number} interior angle at B in degrees
 */
function angleBetween(A, B, C) {
  const BAx = A.x - B.x;
  const BAy = A.y - B.y;
  const BCx = C.x - B.x;
  const BCy = C.y - B.y;
  const dot = BAx * BCx + BAy * BCy;
  const magBA = Math.hypot(BAx, BAy);
  const magBC = Math.hypot(BCx, BCy);
  if (magBA === 0 || magBC === 0) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Compute the miter-cut angle needed for a chop saw.
 * Miter angle = (180 - interior_angle) / 2
 *
 * @param {number} interiorDeg - interior angle between two segments (degrees)
 * @returns {number} miter cut angle in degrees
 */
function miterAngle(interiorDeg) {
  return (180 - interiorDeg) / 2;
}

/**
 * Kerf-adjusted segment length.
 * Each cut removes `kerfMm` of material; shift both ends inward by half.
 *
 * @param {number} nominalLengthMm  - nominal segment length in mm
 * @param {number} kerfMm           - kerf width in mm (tool-specific)
 * @returns {number} adjusted length in mm
 */
function kerfAdjustedLength(nominalLengthMm, kerfMm) {
  if (kerfMm < 0) throw new Error('kerfMm must be non-negative');
  return nominalLengthMm - kerfMm;
}

/**
 * Bend deduction (BD) — the amount of flat material "consumed" by a bend.
 * Formula: BD = (π/2) × (insideRadius + thickness / 3)
 *
 * @param {number} insideRadiusMm  - inside bend radius in mm
 * @param {number} thicknessMm     - material thickness in mm
 * @returns {number} bend deduction in mm
 */
function bendDeduction(insideRadiusMm, thicknessMm) {
  if (insideRadiusMm < 0) throw new Error('insideRadiusMm must be non-negative');
  if (thicknessMm <= 0) throw new Error('thicknessMm must be positive');
  return (Math.PI / 2) * (insideRadiusMm + thicknessMm / 3);
}

/**
 * Bevel and root-gap calculator.
 * Given wire diameter and material thickness, returns:
 *   - rootGapMm: required root opening
 *   - landingMm: required root face (landing)
 *
 * Rule-of-thumb (AWS D1.1):
 *   rootGap  ≈ wireDiameter
 *   landing  ≈ max(1, thicknessMm * 0.1)  (at least 1 mm, up to 10% of thickness)
 *
 * @param {number} wireDiameterMm
 * @param {number} thicknessMm
 * @returns {{ rootGapMm: number, landingMm: number }}
 */
function bevelGap(wireDiameterMm, thicknessMm) {
  if (wireDiameterMm <= 0) throw new Error('wireDiameterMm must be positive');
  if (thicknessMm <= 0) throw new Error('thicknessMm must be positive');
  const rootGapMm = wireDiameterMm;
  const landingMm = Math.max(1, thicknessMm * 0.1);
  return { rootGapMm, landingMm };
}

/**
 * Weld volume estimator.
 * V = cross_section_area × weld_length
 *
 * Cross-section area for a fillet weld: A = 0.5 × leg × leg
 * For a butt/groove weld: A = thickness × (rootGap + 0.5 × bevelAngleRad × thickness)
 *
 * This function accepts a pre-computed cross-section area for flexibility.
 *
 * @param {number} crossSectionMm2  - weld cross-section area in mm²
 * @param {number} weldLengthMm     - total weld run length in mm
 * @returns {{ volumeMm3: number, volumeCm3: number, volumeIn3: number }}
 */
function weldVolume(crossSectionMm2, weldLengthMm) {
  if (crossSectionMm2 <= 0) throw new Error('crossSectionMm2 must be positive');
  if (weldLengthMm <= 0) throw new Error('weldLengthMm must be positive');
  const volumeMm3 = crossSectionMm2 * weldLengthMm;
  const volumeCm3 = volumeMm3 / 1000;
  const volumeIn3 = volumeMm3 / 16387.064;
  return { volumeMm3, volumeCm3, volumeIn3 };
}

/**
 * Fillet weld cross-section area (equal-leg fillet).
 *
 * @param {number} legMm - fillet leg size in mm
 * @returns {number} area in mm²
 */
function filletCrossSection(legMm) {
  if (legMm <= 0) throw new Error('legMm must be positive');
  return 0.5 * legMm * legMm;
}

/**
 * Build a cut list from an array of polygon segments.
 *
 * @param {Array<{lengthPx: number, angle: number}>} segments
 *   - lengthPx: segment length in pixels
 *   - angle: miter angle in degrees for this segment's start cut
 * @param {number} ppi       - pixels per inch
 * @param {number} kerfMm    - kerf width in mm (0 = no adjustment)
 * @returns {Array<{label:string, lengthIn:number, lengthMm:number, miterDeg:number, kerfAdjLengthMm:number}>}
 */
function buildCutList(segments, ppi, kerfMm = 0) {
  return segments.map((seg, i) => {
    const lengthIn = pixelsToInches(seg.lengthPx, ppi);
    const lengthMm = inchesToMm(lengthIn);
    const kerfAdjLengthMm = kerfAdjustedLength(lengthMm, kerfMm);
    return {
      label: `P${i + 1}`,
      lengthIn: +lengthIn.toFixed(3),
      lengthMm: +lengthMm.toFixed(2),
      miterDeg: +seg.angle.toFixed(1),
      kerfAdjLengthMm: +kerfAdjLengthMm.toFixed(2),
    };
  });
}

module.exports = {
  computePPI,
  pixelsToInches,
  inchesToMm,
  angleBetween,
  miterAngle,
  kerfAdjustedLength,
  bendDeduction,
  bevelGap,
  weldVolume,
  filletCrossSection,
  buildCutList,
};

/**
 * WeldScan 3D — Node.js DXF Generator
 *
 * Generates a CNC-ready DXF R12 ASCII file from contour segments.
 * Each segment becomes a LINE entity. Coordinates are converted
 * from pixels → inches (DXF drawing unit = 1 inch, INSUNITS=1).
 *
 * Coordinate system note:
 *   Screen pixels use a top-left origin with positive-Y pointing downward.
 *   CAD/DXF coordinates use positive-Y pointing upward.
 *   The Y axis is therefore negated during conversion (y_dxf = -y_pixels / ppi).
 *
 * Returns a plain string (UTF-8) suitable for writing to a .dxf file.
 */

/**
 * @param {Array<{startPoint:{x,y}, endPoint:{x,y}}>} segments
 * @param {number} ppi  - pixels-per-inch calibration constant
 * @param {string} [title]
 * @returns {string}  DXF file content
 */
function generateDxf(segments, ppi, title = 'WeldScan 3D') {
  const lines = [];

  const push = (...args) => lines.push(...args);

  // ── HEADER section ────────────────────────────────────────────────────────
  push(
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER',
    '1', 'AC1009',        // R12 version code
    '9', '$INSUNITS',
    '70', '1',            // 1 = inches
    '9', '$EXTMIN',
    '10', '0.0',
    '20', '0.0',
    '9', '$EXTMAX',
    '10', '100.0',
    '20', '100.0',
    '0', 'ENDSEC',
  );

  // ── TABLES section (minimal) ──────────────────────────────────────────────
  push(
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE',
    '2', 'LAYER',
    '70', '1',
    '0', 'LAYER',
    '2', '0',             // default layer
    '70', '0',
    '62', '7',            // white
    '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
  );

  // ── BLOCKS section (required but empty) ───────────────────────────────────
  push(
    '0', 'SECTION',
    '2', 'BLOCKS',
    '0', 'ENDSEC',
  );

  // ── ENTITIES section ──────────────────────────────────────────────────────
  push('0', 'SECTION', '2', 'ENTITIES');

  for (const seg of segments) {
    const x1 = (seg.startPoint.x / ppi).toFixed(6);
    const y1 = (-(seg.startPoint.y) / ppi).toFixed(6); // flip Y: screen → CAD
    const x2 = (seg.endPoint.x / ppi).toFixed(6);
    const y2 = (-(seg.endPoint.y) / ppi).toFixed(6);
    push(
      '0', 'LINE',
      '8', '0',           // layer 0
      '10', x1,
      '20', y1,
      '30', '0.0',
      '11', x2,
      '21', y2,
      '31', '0.0',
    );
  }

  push('0', 'ENDSEC');
  push('0', 'EOF');

  return lines.join('\n');
}

module.exports = { generateDxf };

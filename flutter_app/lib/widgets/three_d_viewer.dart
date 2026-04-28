import 'dart:math' as math;
import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ThreeDViewer
//
// Renders the cut-list in 3D.  Two modes:
//
//   Assembled mode  — when [polygonPointsIn] is provided (draw-mode).
//     Shows the polygon extruded as a flat metal plate, with dimension
//     callouts on every edge.  Single-finger drag orbits; pinch zooms.
//
//   Bar-layout mode — when [polygonPointsIn] is null (photo mode).
//     Shows each cut piece as a separate rectangular prism, laid out
//     side-by-side (the original behaviour).
//
// Interaction (both modes):
//   • Single-finger drag → orbit (azimuth / elevation)
//   • Pinch               → zoom
// ─────────────────────────────────────────────────────────────────────────────

class ThreeDViewer extends StatefulWidget {
  final List<Map<String, dynamic>> cutList;
  final double thicknessMm;

  /// Polygon outline vertices in world-inch coordinates (draw mode).
  /// When provided the assembled-shape view is used instead of bars.
  final List<Offset>? polygonPointsIn;

  const ThreeDViewer({
    super.key,
    required this.cutList,
    required this.thicknessMm,
    this.polygonPointsIn,
  });

  @override
  State<ThreeDViewer> createState() => _ThreeDViewerState();
}

class _ThreeDViewerState extends State<ThreeDViewer> {
  double _azimuth = 0.5;
  double _elevation = 0.4;
  double _zoom = 1.0;

  double _lastScale = 1.0;
  Offset _lastFocal = Offset.zero;
  bool _hasInteracted = false;

  void _onScaleStart(ScaleStartDetails d) {
    _lastScale = _zoom;
    _lastFocal = d.focalPoint;
  }

  void _onScaleUpdate(ScaleUpdateDetails d) {
    setState(() {
      _hasInteracted = true;
      if (d.pointerCount >= 2) {
        _zoom = (_lastScale * d.scale).clamp(0.25, 5.0);
      } else {
        final dx = d.focalPoint.dx - _lastFocal.dx;
        final dy = d.focalPoint.dy - _lastFocal.dy;
        _azimuth -= dx * 0.01;
        _elevation = (_elevation - dy * 0.01)
            .clamp(-math.pi / 2 + 0.05, math.pi / 2 - 0.05);
      }
      _lastFocal = d.focalPoint;
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onScaleStart: _onScaleStart,
      onScaleUpdate: _onScaleUpdate,
      child: Stack(
        children: [
          CustomPaint(
            painter: _Scene3DPainter(
              cutList: widget.cutList,
              thicknessMm: widget.thicknessMm,
              polygonPointsIn: widget.polygonPointsIn,
              azimuth: _azimuth,
              elevation: _elevation,
              zoom: _zoom,
            ),
            child: const SizedBox.expand(),
          ),
          if (!_hasInteracted) const Positioned(bottom: 16, left: 0, right: 0, child: _HintBadge()),
        ],
      ),
    );
  }
}

// ─── Face data ───────────────────────────────────────────────────────────────

class _Face3D {
  final List<List<double>> verts; // 4+ × [x, y, z] world inches
  final Color color;
  final String? label;
  final List<_DimArrow>? dimArrows; // edge dimension callouts

  const _Face3D(this.verts, this.color, {this.label, this.dimArrows});
}

class _DimArrow {
  final List<double> a; // world start [x,y,z]
  final List<double> b; // world end   [x,y,z]
  final List<double> labelPos; // world label position
  final String text;

  const _DimArrow(this.a, this.b, this.labelPos, this.text);
}

// ─── Painter ────────────────────────────────────────────────────────────────

class _Scene3DPainter extends CustomPainter {
  final List<Map<String, dynamic>> cutList;
  final double thicknessMm;
  final List<Offset>? polygonPointsIn;
  final double azimuth;
  final double elevation;
  final double zoom;

  const _Scene3DPainter({
    required this.cutList,
    required this.thicknessMm,
    required this.polygonPointsIn,
    required this.azimuth,
    required this.elevation,
    required this.zoom,
  });

  // ── Rotation / projection ─────────────────────────────────────────────────

  static List<double> _rotY(List<double> p, double a) {
    final ca = math.cos(a), sa = math.sin(a);
    return [p[0] * ca + p[2] * sa, p[1], -p[0] * sa + p[2] * ca];
  }

  static List<double> _rotX(List<double> p, double a) {
    final ca = math.cos(a), sa = math.sin(a);
    return [p[0], p[1] * ca - p[2] * sa, p[1] * sa + p[2] * ca];
  }

  List<double> _rotate(List<double> p) => _rotX(_rotY(p, azimuth), elevation);

  Offset _project(List<double> world, double ppu, double focal, double cx, double cy) {
    final r = _rotate(world);
    final s = focal / (focal + r[2] * ppu);
    return Offset(cx + r[0] * ppu * s, cy - r[1] * ppu * s);
  }

  double _faceDepth(List<List<double>> verts) {
    var sum = 0.0;
    for (final v in verts) sum += _rotate(v)[2];
    return sum / verts.length;
  }

  // ── Assembled polygon mode ────────────────────────────────────────────────

  List<_Face3D> _assembledFaces(double thickIn) {
    final pts = polygonPointsIn!;
    final n = pts.length;
    final ht = thickIn / 2;

    // Centre the polygon
    double cx = 0, cy = 0;
    for (final p in pts) { cx += p.dx; cy += p.dy; }
    cx /= n; cy /= n;

    List<double> top(int i) => [pts[i].dx - cx, ht, -(pts[i].dy - cy)];
    List<double> bot(int i) => [pts[i].dx - cx, -ht, -(pts[i].dy - cy)];

    final faces = <_Face3D>[];

    // Top face (polygon)
    final topVerts = List<List<double>>.generate(n, (i) => top(i));
    final dimArrows = <_DimArrow>[];
    for (int i = 0; i < n; i++) {
      final a = top(i);
      final b = top((i + 1) % n);
      final mx = (a[0] + b[0]) / 2;
      final mz = (a[2] + b[2]) / 2;
      // Outward normal on the XZ plane
      final dx = b[0] - a[0], dz = b[2] - a[2];
      final len = math.sqrt(dx * dx + dz * dz);
      final nx = dz / len, nz = -dx / len; // perpendicular, outward
      // Edge length from the original screen-space polygon (in world inches)
      final edgeDx = pts[i].dx - pts[(i + 1) % n].dx;
      final edgeDy = pts[i].dy - pts[(i + 1) % n].dy;
      final lenIn = math.sqrt(edgeDx * edgeDx + edgeDy * edgeDy);
      final lenMm = lenIn * 25.4;
      final label = 'P${i + 1}: ${lenIn.toStringAsFixed(2)}" / ${lenMm.toStringAsFixed(1)}mm';
      dimArrows.add(_DimArrow(
        a, b,
        [mx + nx * 0.35, ht + 0.1, mz + nz * 0.35],
        label,
      ));
    }
    faces.add(_Face3D(topVerts, const Color(0xFFC8CDD8), label: null, dimArrows: dimArrows));

    // Bottom face (reversed winding)
    final botVerts = List<List<double>>.generate(n, (i) => bot(n - 1 - i));
    faces.add(_Face3D(botVerts, const Color(0xFF424850)));

    // Side faces
    for (int i = 0; i < n; i++) {
      final j = (i + 1) % n;
      faces.add(_Face3D([top(i), top(j), bot(j), bot(i)], const Color(0xFF8E95A4)));
    }

    // Ground tint
    final ex = pts.map((p) => (p.dx - cx).abs()).reduce(math.max) + 0.5;
    final ez = pts.map((p) => (p.dy - cy).abs()).reduce(math.max) + 0.5;
    faces.insert(0, _Face3D([
      [-ex, -ht, -ez], [ex, -ht, -ez],
      [ex, -ht, ez],  [-ex, -ht, ez],
    ], const Color(0x22FF6B00)));

    return faces;
  }

  // ── Bar-layout mode ───────────────────────────────────────────────────────

  List<_Face3D> _boxFaces(
    double cx, double cy, double cz,
    double hl, double ht, String label,
  ) {
    final v = [
      [cx - hl, cy - ht, cz - ht],
      [cx + hl, cy - ht, cz - ht],
      [cx + hl, cy + ht, cz - ht],
      [cx - hl, cy + ht, cz - ht],
      [cx - hl, cy - ht, cz + ht],
      [cx + hl, cy - ht, cz + ht],
      [cx + hl, cy + ht, cz + ht],
      [cx - hl, cy + ht, cz + ht],
    ];
    return [
      _Face3D([v[3], v[2], v[6], v[7]], const Color(0xFFC8CDD8), label: label),
      _Face3D([v[0], v[1], v[2], v[3]], const Color(0xFF8E95A4)),
      _Face3D([v[5], v[4], v[7], v[6]], const Color(0xFF717880)),
      _Face3D([v[4], v[0], v[3], v[7]], const Color(0xFF636A75)),
      _Face3D([v[1], v[5], v[6], v[2]], const Color(0xFF636A75)),
      _Face3D([v[4], v[5], v[1], v[0]], const Color(0xFF424850)),
    ];
  }

  // ── Paint ─────────────────────────────────────────────────────────────────

  @override
  void paint(Canvas canvas, Size size) {
    if (cutList.isEmpty && polygonPointsIn == null) return;

    final thickIn = thicknessMm / 25.4;
    final cx = size.width / 2;
    final cy = size.height / 2;

    late double sceneExtent;
    late List<_Face3D> allFaces;

    if (polygonPointsIn != null && polygonPointsIn!.isNotEmpty) {
      // ── Assembled mode ─────────────────────────────────────────────────────
      final pts = polygonPointsIn!;
      final maxDim = pts
          .map((p) => math.max(p.dx.abs(), p.dy.abs()))
          .reduce(math.max);
      sceneExtent = maxDim + thickIn;
      allFaces = _assembledFaces(thickIn);
    } else {
      // ── Bar-layout mode ────────────────────────────────────────────────────
      final lengths = cutList
          .map((p) => (p['lengthIn'] as num).toDouble())
          .toList();
      final gap = thickIn * 0.45;
      final totalWidth = lengths.fold(0.0, (s, l) => s + l) +
          gap * math.max(lengths.length - 1, 0);
      sceneExtent = math.max(totalWidth / 2, thickIn) * 1.3;

      allFaces = [];
      // Ground quad
      allFaces.add(_Face3D([
        [-(totalWidth / 2 + gap), -thickIn / 2, -thickIn * 2],
        [totalWidth / 2 + gap, -thickIn / 2, -thickIn * 2],
        [totalWidth / 2 + gap, -thickIn / 2, thickIn * 2],
        [-(totalWidth / 2 + gap), -thickIn / 2, thickIn * 2],
      ], const Color(0x22FF6B00)));

      double xOffset = -totalWidth / 2;
      for (int i = 0; i < cutList.length; i++) {
        final label = cutList[i]['label'] as String? ?? 'P${i + 1}';
        final len = lengths[i];
        allFaces.addAll(_boxFaces(xOffset + len / 2, 0, 0, len / 2, thickIn / 2, label));
        xOffset += len + gap;
      }
    }

    final ppu = (size.shortestSide * 0.38 * zoom) / sceneExtent;
    final focal = sceneExtent * ppu * 2.8;

    // Depth-sort (painter's algorithm)
    allFaces.sort((a, b) => _faceDepth(a.verts).compareTo(_faceDepth(b.verts)));

    final fillPaint = Paint()..style = PaintingStyle.fill;
    final edgePaint = Paint()
      ..color = Colors.black45
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8;
    final dimLinePaint = Paint()
      ..color = const Color(0xFFFF6B00)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    for (final face in allFaces) {
      final pts2d = face.verts.map((v) => _project(v, ppu, focal, cx, cy)).toList();

      final path = Path()..moveTo(pts2d[0].dx, pts2d[0].dy);
      for (int i = 1; i < pts2d.length; i++) path.lineTo(pts2d[i].dx, pts2d[i].dy);
      path.close();

      fillPaint.color = face.color;
      canvas.drawPath(path, fillPaint);
      canvas.drawPath(path, edgePaint);

      // Piece label on top face (bar mode)
      if (face.label != null) {
        final center = pts2d.fold(Offset.zero, (s, p) => s + p) / pts2d.length.toDouble();
        _drawText(canvas, face.label!, center, const Color(0xFFFF6B00), 9, bold: true);
      }

      // Dimension arrows (assembled mode — drawn on top face)
      if (face.dimArrows != null) {
        for (final arrow in face.dimArrows!) {
          final pa = _project(arrow.a, ppu, focal, cx, cy);
          final pb = _project(arrow.b, ppu, focal, cx, cy);
          final pl = _project(arrow.labelPos, ppu, focal, cx, cy);

          // Dimension extension lines
          canvas.drawLine(pa, pl, dimLinePaint);
          canvas.drawLine(pb, pl, dimLinePaint);
          // Arrow ticks
          _drawTick(canvas, pa, pb, dimLinePaint);
          _drawTick(canvas, pb, pa, dimLinePaint);
          // Label
          _drawText(canvas, arrow.text, pl, const Color(0xFF00C8FF), 9, bold: true);
        }
      }
    }
  }

  static void _drawTick(Canvas canvas, Offset at, Offset toward, Paint paint) {
    final dx = toward.dx - at.dx;
    final dy = toward.dy - at.dy;
    final len = math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    final ux = dx / len, uy = dy / len;
    // Perpendicular
    final nx = -uy * 5, ny = ux * 5;
    canvas.drawLine(
      Offset(at.dx + nx, at.dy + ny),
      Offset(at.dx - nx, at.dy - ny),
      paint,
    );
  }

  static void _drawText(Canvas canvas, String text, Offset center, Color color, double size,
      {bool bold = false}) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: color,
          fontSize: size,
          fontWeight: bold ? FontWeight.bold : FontWeight.normal,
          shadows: const [Shadow(color: Colors.black87, blurRadius: 3)],
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, center - Offset(tp.width / 2, tp.height / 2));
  }

  @override
  bool shouldRepaint(_Scene3DPainter old) =>
      old.azimuth != azimuth ||
      old.elevation != elevation ||
      old.zoom != zoom ||
      old.thicknessMm != thicknessMm ||
      old.cutList != cutList ||
      old.polygonPointsIn != polygonPointsIn;
}

// ─── Hint badge ──────────────────────────────────────────────────────────────

class _HintBadge extends StatelessWidget {
  const _HintBadge();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.black54,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFFF6B00).withOpacity(0.5)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.swipe_rounded, size: 16, color: Color(0xFFFF6B00)),
            SizedBox(width: 6),
            Text(
              'Drag to rotate  •  Pinch to zoom',
              style: TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

/// Orbit-able 3D viewer that renders cut-list pieces as metal bars.
///
/// Interaction:
///   - Single-finger drag  → orbit (azimuth / elevation)
///   - Pinch               → zoom
class ThreeDViewer extends StatefulWidget {
  final List<Map<String, dynamic>> cutList;
  final double thicknessMm;

  const ThreeDViewer({
    super.key,
    required this.cutList,
    required this.thicknessMm,
  });

  @override
  State<ThreeDViewer> createState() => _ThreeDViewerState();
}

class _ThreeDViewerState extends State<ThreeDViewer> {
  double _azimuth = 0.5;   // horizontal orbit, radians
  double _elevation = 0.4; // vertical orbit, radians
  double _zoom = 1.0;

  double _lastScale = 1.0;
  Offset _lastFocal = Offset.zero;

  bool _hasInteracted = false;

  void _onScaleStart(ScaleStartDetails d) {
    _lastScale = _zoom;
    _lastFocal = d.focalPoint;
  }

  void _onScaleUpdate(ScaleUpdateDetails d) {
    setState(() {
      _hasInteracted = true;
      if (d.pointerCount >= 2) {
        // Pinch-to-zoom
        _zoom = (_lastScale * d.scale).clamp(0.25, 5.0);
      } else {
        // Single-finger orbit
        final dx = d.focalPoint.dx - _lastFocal.dx;
        final dy = d.focalPoint.dy - _lastFocal.dy;
        _azimuth -= dx * 0.01;
        _elevation = (_elevation - dy * 0.01)
            .clamp(-math.pi / 2 + 0.05, math.pi / 2 - 0.05);
      }
      _lastFocal = d.focalPoint;
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onScaleStart: _onScaleStart,
      onScaleUpdate: _onScaleUpdate,
      child: Stack(
        children: [
          CustomPaint(
            painter: _Scene3DPainter(
              cutList: widget.cutList,
              thicknessMm: widget.thicknessMm,
              azimuth: _azimuth,
              elevation: _elevation,
              zoom: _zoom,
            ),
            child: const SizedBox.expand(),
          ),
          // Hint that fades once the user has touched the scene
          if (!_hasInteracted)
            const Positioned(
              bottom: 16,
              left: 0,
              right: 0,
              child: _HintBadge(),
            ),
        ],
      ),
    );
  }
}

// ─── Face data ──────────────────────────────────────────────────────────────

class _Face3D {
  final List<List<double>> verts; // 4 × [x, y, z] in world inches
  final Color color;
  final String? label; // drawn on top faces only

  const _Face3D(this.verts, this.color, {this.label});
}

// ─── Painter ────────────────────────────────────────────────────────────────

class _Scene3DPainter extends CustomPainter {
  final List<Map<String, dynamic>> cutList;
  final double thicknessMm;
  final double azimuth;
  final double elevation;
  final double zoom;

  const _Scene3DPainter({
    required this.cutList,
    required this.thicknessMm,
    required this.azimuth,
    required this.elevation,
    required this.zoom,
  });

  // ── Rotation helpers ──────────────────────────────────────────────────────

  /// Rotate point [x, y, z] around the Y axis by [a] radians.
  static List<double> _rotY(List<double> p, double a) {
    final ca = math.cos(a), sa = math.sin(a);
    return [p[0] * ca + p[2] * sa, p[1], -p[0] * sa + p[2] * ca];
  }

  /// Rotate point around the X axis by [a] radians.
  static List<double> _rotX(List<double> p, double a) {
    final ca = math.cos(a), sa = math.sin(a);
    return [p[0], p[1] * ca - p[2] * sa, p[1] * sa + p[2] * ca];
  }

  /// Full orbit rotation: Y first, then X.
  List<double> _rotate(List<double> p) => _rotX(_rotY(p, azimuth), elevation);

  // ── Projection ────────────────────────────────────────────────────────────

  /// Project a world-space point (inches) to screen [Offset].
  ///
  /// [ppu]   pixels-per-inch (scene scale)
  /// [focal] perspective focal distance in pixels
  /// [cx/cy] screen centre
  Offset _project(
    List<double> world,
    double ppu,
    double focal,
    double cx,
    double cy,
  ) {
    final r = _rotate(world);
    final xp = r[0] * ppu;
    final yp = r[1] * ppu;
    final zp = r[2] * ppu;
    final s = focal / (focal + zp);
    return Offset(cx + xp * s, cy - yp * s);
  }

  // ── Depth ─────────────────────────────────────────────────────────────────

  double _faceDepth(List<List<double>> verts) {
    var sum = 0.0;
    for (final v in verts) {
      sum += _rotate(v)[2];
    }
    return sum / verts.length;
  }

  // ── Box builder ───────────────────────────────────────────────────────────

  List<_Face3D> _boxFaces(
    double cx,
    double cy,
    double cz,
    double hl, // half-length
    double ht, // half-thickness
    String label,
  ) {
    // 8 corners of the rectangular prism
    final v = [
      [cx - hl, cy - ht, cz - ht], // 0 front-bottom-left
      [cx + hl, cy - ht, cz - ht], // 1 front-bottom-right
      [cx + hl, cy + ht, cz - ht], // 2 front-top-right
      [cx - hl, cy + ht, cz - ht], // 3 front-top-left
      [cx - hl, cy - ht, cz + ht], // 4 back-bottom-left
      [cx + hl, cy - ht, cz + ht], // 5 back-bottom-right
      [cx + hl, cy + ht, cz + ht], // 6 back-top-right
      [cx - hl, cy + ht, cz + ht], // 7 back-top-left
    ];

    return [
      _Face3D([v[3], v[2], v[6], v[7]], const Color(0xFFC8CDD8), label: label), // top
      _Face3D([v[0], v[1], v[2], v[3]], const Color(0xFF8E95A4)),                // front
      _Face3D([v[5], v[4], v[7], v[6]], const Color(0xFF717880)),                // back
      _Face3D([v[4], v[0], v[3], v[7]], const Color(0xFF636A75)),                // left
      _Face3D([v[1], v[5], v[6], v[2]], const Color(0xFF636A75)),                // right
      _Face3D([v[4], v[5], v[1], v[0]], const Color(0xFF424850)),                // bottom
    ];
  }

  // ── Ground grid builder ───────────────────────────────────────────────────

  List<_Face3D> _groundGrid(double halfW, double halfD, double gridY) {
    // A single quad for the floor shadow tint
    return [
      _Face3D(
        [
          [-halfW, gridY, -halfD],
          [halfW, gridY, -halfD],
          [halfW, gridY, halfD],
          [-halfW, gridY, halfD],
        ],
        const Color(0x22FF6B00), // translucent orange tint
      ),
    ];
  }

  // ── Paint ─────────────────────────────────────────────────────────────────

  @override
  void paint(Canvas canvas, Size size) {
    if (cutList.isEmpty) return;

    final thickIn = thicknessMm / 25.4;
    final gap = thickIn * 0.45;

    final lengths = cutList
        .map((p) => (p['lengthIn'] as num).toDouble())
        .toList();

    final totalWidth =
        lengths.fold(0.0, (s, l) => s + l) +
            gap * math.max(lengths.length - 1, 0);
    final sceneExtent = math.max(totalWidth / 2, thickIn) * 1.3;

    final ppu = (size.shortestSide * 0.38 * zoom) / sceneExtent;
    final focal = sceneExtent * ppu * 2.8; // perspective focal length

    final cx = size.width / 2;
    final cy = size.height / 2;

    final allFaces = <_Face3D>[];

    // Ground quad
    allFaces.addAll(
      _groundGrid(totalWidth / 2 + gap, thickIn * 2, -thickIn / 2),
    );

    // Piece boxes
    double xOffset = -totalWidth / 2;
    for (int i = 0; i < cutList.length; i++) {
      final label =
          cutList[i]['label'] as String? ?? 'P${i + 1}';
      final len = lengths[i];
      final boxCx = xOffset + len / 2;
      allFaces.addAll(
        _boxFaces(boxCx, 0, 0, len / 2, thickIn / 2, label),
      );
      xOffset += len + gap;
    }

    // Depth-sort (painter's algorithm: back → front)
    allFaces.sort(
      (a, b) => _faceDepth(a.verts).compareTo(_faceDepth(b.verts)),
    );

    final fillPaint = Paint()..style = PaintingStyle.fill;
    final edgePaint = Paint()
      ..color = Colors.black45
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8;

    for (final face in allFaces) {
      final pts = face.verts
          .map((v) => _project(v, ppu, focal, cx, cy))
          .toList();

      final path = Path()..moveTo(pts[0].dx, pts[0].dy);
      for (int i = 1; i < pts.length; i++) {
        path.lineTo(pts[i].dx, pts[i].dy);
      }
      path.close();

      fillPaint.color = face.color;
      canvas.drawPath(path, fillPaint);
      canvas.drawPath(path, edgePaint);

      // Label on top face
      if (face.label != null) {
        final center = pts.fold(Offset.zero, (s, p) => s + p) /
            pts.length.toDouble();
        final tp = TextPainter(
          text: TextSpan(
            text: face.label,
            style: const TextStyle(
              color: Color(0xFFFF6B00),
              fontSize: 9,
              fontWeight: FontWeight.bold,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(
          canvas,
          center - Offset(tp.width / 2, tp.height / 2),
        );
      }
    }
  }

  @override
  bool shouldRepaint(_Scene3DPainter old) =>
      old.azimuth != azimuth ||
      old.elevation != elevation ||
      old.zoom != zoom ||
      old.thicknessMm != thicknessMm ||
      old.cutList != cutList;
}

// ─── Hint badge ─────────────────────────────────────────────────────────────

class _HintBadge extends StatelessWidget {
  const _HintBadge();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.black54,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFFF6B00).withOpacity(0.5)),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.swipe_rounded, size: 16, color: Color(0xFFFF6B00)),
            SizedBox(width: 6),
            Text(
              'Drag to rotate  •  Pinch to zoom',
              style: TextStyle(color: Colors.white70, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

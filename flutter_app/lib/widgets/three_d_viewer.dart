import 'dart:math' as math;
import 'package:flutter/material.dart';

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

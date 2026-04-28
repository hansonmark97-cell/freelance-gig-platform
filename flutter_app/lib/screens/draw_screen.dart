import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'review_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// DrawScreen — finger-draw a polygon shape, then get a full 3D blueprint.
//
// Flow:
//   1. Tap canvas to place vertices.
//   2. Drag after placing ≥2 points: a rubber-band line follows the finger.
//   3. Tap near the first vertex (≤ SNAP_RADIUS) or press "Close Shape"
//      to close the polygon.
//   4. Adjust the Scale Ruler (pixels per inch) so dimensions shown are
//      the real-world size you need.
//   5. Press "Analyze & View Blueprint" → synthetic calibrate → analyze →
//      navigate to ReviewScreen with the polygon and assembled 3D view.
// ─────────────────────────────────────────────────────────────────────────────

const double _kSnapRadius = 22.0; // px – snap-close distance

class DrawScreen extends StatefulWidget {
  /// Optional: pre-fill the canvas with these world-inch polygon points
  /// (used when opening a preloaded blueprint).
  final List<Offset>? initialPointsIn;
  final double? initialPpi;
  final String? title;
  final double? initialThicknessMm;

  const DrawScreen({
    super.key,
    this.initialPointsIn,
    this.initialPpi,
    this.title,
    this.initialThicknessMm,
  });

  @override
  State<DrawScreen> createState() => _DrawScreenState();
}

class _DrawScreenState extends State<DrawScreen> {
  final List<Offset> _points = [];
  bool _isClosed = false;
  Offset? _rubberBand; // current finger position during drag

  // Scale: how many screen pixels represent one real inch.
  // Default 60 px/in → a 360 px wide phone canvas ≈ 6 inches wide.
  double _ppi = 60.0;

  double _thicknessMm = 10.0;
  double _kerfMm = 1.5;
  String _kerfType = 'plasma';

  bool _isAnalyzing = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Pre-fill points from a blueprint template
    if (widget.initialPointsIn != null && widget.initialPointsIn!.isNotEmpty) {
      final ppi = widget.initialPpi ?? 30.0;
      _ppi = ppi;
      _points.addAll(
        widget.initialPointsIn!.map((p) => Offset(p.dx * ppi, p.dy * ppi)),
      );
      _isClosed = true;
    }
    if (widget.initialThicknessMm != null) {
      _thicknessMm = widget.initialThicknessMm!;
    }
  }

  static const _kerfDefaults = {
    'plasma': 1.5,
    'laser': 0.3,
    'saw': 3.2,
  };

  // ── Geometry helpers ──────────────────────────────────────────────────────

  bool _isNearFirst(Offset p) {
    if (_points.isEmpty) return false;
    return (_points.first - p).distance < _kSnapRadius;
  }

  double _edgeLengthIn(Offset a, Offset b) => (a - b).distance / _ppi;
  double _edgeLengthMm(Offset a, Offset b) => _edgeLengthIn(a, b) * 25.4;

  List<Map<String, dynamic>> _buildSegments() {
    final n = _points.length;
    final segs = <Map<String, dynamic>>[];
    for (int i = 0; i < n; i++) {
      final p1 = _points[i];
      final p2 = _points[(i + 1) % n];
      segs.add({
        'lengthPx': (p1 - p2).distance,
        'startPoint': {'x': p1.dx, 'y': p1.dy},
        'endPoint': {'x': p2.dx, 'y': p2.dy},
      });
    }
    return segs;
  }

  // ── Gesture handlers ───────────────────────────────────────────────────────

  void _onTapDown(TapDownDetails d) {
    if (_isClosed || _isAnalyzing) return;
    final pt = d.localPosition;

    // Snap-close when tapping near first vertex (and we have ≥ 3 points).
    if (_points.length >= 3 && _isNearFirst(pt)) {
      setState(() {
        _isClosed = true;
        _rubberBand = null;
      });
      return;
    }

    setState(() {
      _points.add(pt);
      _rubberBand = null;
      _error = null;
    });
  }

  void _onPanUpdate(DragUpdateDetails d) {
    if (_isClosed || _points.isEmpty || _isAnalyzing) return;
    setState(() => _rubberBand = d.localPosition);
  }

  void _onPanEnd(DragEndDetails d) {
    setState(() => _rubberBand = null);
  }

  void _closeShape() {
    if (_points.length < 3) {
      setState(() => _error = 'Add at least 3 points before closing.');
      return;
    }
    setState(() {
      _isClosed = true;
      _rubberBand = null;
    });
  }

  void _undo() {
    if (_points.isEmpty) return;
    setState(() {
      if (_isClosed) {
        _isClosed = false;
      } else {
        _points.removeLast();
      }
      _error = null;
    });
  }

  void _clear() {
    setState(() {
      _points.clear();
      _isClosed = false;
      _rubberBand = null;
      _error = null;
    });
  }

  // ── Analyze ───────────────────────────────────────────────────────────────

  Future<void> _analyze() async {
    if (_points.length < 3) {
      setState(() => _error = 'Draw and close a shape first.');
      return;
    }
    setState(() {
      _isAnalyzing = true;
      _error = null;
    });

    try {
      final api = ApiService();

      // 1. Synthetic calibration — tell the backend that [_ppi] pixels = 1 real inch,
      //    so all drawn pixel coordinates are correctly scaled on the server.
      final calibRes = await api.draftCalibrate(ppi: _ppi);
      final sessionId = calibRes['sessionId'] as String;

      // 2. Analyze with drawn segments
      final segments = _buildSegments();
      final analysisRes = await api.analyzeSegments(
        sessionId: sessionId,
        segments: segments,
        thicknessMm: _thicknessMm,
        kerfMm: _kerfMm,
      );

      if (!mounted) return;

      // Polygon points converted to world-inches (centred at origin)
      final polygonIn = _points.map((p) => Offset(p.dx / _ppi, p.dy / _ppi)).toList();

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ReviewScreen(
            imageFile: null,
            sessionId: sessionId,
            ppi: _ppi,
            preloadedAnalysis: analysisRes,
            polygonPointsIn: polygonIn,
          ),
        ),
      );
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isAnalyzing = false;
      });
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final canClose = _points.length >= 3 && !_isClosed;

    return Scaffold(
      backgroundColor: cs.background,
      appBar: AppBar(
        backgroundColor: cs.surface,
        title: Text(widget.title ?? 'Draw Shape'),
        foregroundColor: cs.primary,
        actions: [
          if (_points.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.undo_rounded),
              tooltip: 'Undo',
              onPressed: _undo,
            ),
          IconButton(
            icon: const Icon(Icons.delete_outline_rounded),
            tooltip: 'Clear',
            onPressed: _clear,
          ),
        ],
      ),
      body: Column(
        children: [
          // ── Scale ruler control ────────────────────────────────────────────
          Container(
            color: cs.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              children: [
                Text('Scale:', style: TextStyle(color: cs.secondary, fontSize: 12, fontWeight: FontWeight.bold)),
                Expanded(
                  child: Slider(
                    value: _ppi,
                    min: 20,
                    max: 200,
                    divisions: 36,
                    activeColor: cs.primary,
                    inactiveColor: cs.primary.withOpacity(0.25),
                    onChanged: _isClosed ? null : (v) => setState(() => _ppi = v),
                  ),
                ),
                SizedBox(
                  width: 88,
                  child: Text(
                    '${_ppi.toStringAsFixed(0)} px/in',
                    style: TextStyle(color: cs.primary, fontSize: 11, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),

          // ── Canvas ────────────────────────────────────────────────────────
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTapDown: _onTapDown,
              onPanUpdate: _onPanUpdate,
              onPanEnd: _onPanEnd,
              child: CustomPaint(
                painter: _DrawPainter(
                  points: _points,
                  isClosed: _isClosed,
                  rubberBand: _rubberBand,
                  ppi: _ppi,
                  primaryColor: cs.primary,
                  secondaryColor: cs.secondary,
                ),
                child: const SizedBox.expand(),
              ),
            ),
          ),

          // ── Error ─────────────────────────────────────────────────────────
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
            ),

          // ── Bottom toolbar ────────────────────────────────────────────────
          Container(
            color: cs.surface,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Material + kerf chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      _ParamChip(
                        label: 'Thickness',
                        value: '${_thicknessMm.toStringAsFixed(0)}mm',
                        onTap: () => _showNumberDialog('Metal thickness (mm)', _thicknessMm, (v) {
                          setState(() => _thicknessMm = v);
                        }),
                      ),
                      const SizedBox(width: 8),
                      _ParamChip(
                        label: 'Kerf ($_kerfType)',
                        value: '${_kerfMm.toStringAsFixed(1)}mm',
                        onTap: _showKerfDialog,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.close_rounded, size: 18),
                        label: const Text('Close Shape'),
                        onPressed: canClose ? _closeShape : null,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: cs.primary,
                          side: BorderSide(color: canClose ? cs.primary : cs.primary.withOpacity(0.25)),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: FilledButton.icon(
                        icon: _isAnalyzing
                            ? const SizedBox(
                                width: 16, height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                            : const Icon(Icons.view_in_ar_rounded, size: 20),
                        label: const Text('Analyze & View Blueprint'),
                        onPressed: _isClosed && !_isAnalyzing ? _analyze : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: cs.primary,
                          foregroundColor: Colors.black,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showNumberDialog(String label, double current, void Function(double) onSave) {
    final ctrl = TextEditingController(text: current.toString());
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Theme.of(context).colorScheme.surface,
        title: Text(label),
        content: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final v = double.tryParse(ctrl.text);
              if (v != null && v > 0) { onSave(v); Navigator.pop(context); }
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }

  void _showKerfDialog() {
    showDialog(
      context: context,
      builder: (_) => SimpleDialog(
        backgroundColor: Theme.of(context).colorScheme.surface,
        title: const Text('Select cut tool'),
        children: _kerfDefaults.entries.map((e) => SimpleDialogOption(
          onPressed: () {
            setState(() { _kerfType = e.key; _kerfMm = e.value; });
            Navigator.pop(context);
          },
          child: Text('${e.key}  (${e.value} mm kerf)'),
        )).toList(),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas painter
// ─────────────────────────────────────────────────────────────────────────────

class _DrawPainter extends CustomPainter {
  final List<Offset> points;
  final bool isClosed;
  final Offset? rubberBand;
  final double ppi;
  final Color primaryColor;
  final Color secondaryColor;

  const _DrawPainter({
    required this.points,
    required this.isClosed,
    required this.rubberBand,
    required this.ppi,
    required this.primaryColor,
    required this.secondaryColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    _drawGrid(canvas, size);
    if (points.isEmpty) {
      _drawInstructions(canvas, size);
      return;
    }
    _drawPolygon(canvas, size);
    _drawVertices(canvas);
    if (isClosed) _drawDimensions(canvas);
    if (!isClosed && rubberBand != null && points.isNotEmpty) {
      _drawRubberBand(canvas);
    }
  }

  void _drawGrid(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0x1500C8FF)
      ..strokeWidth = 0.5;
    final spacing = ppi; // 1-inch grid
    for (double x = 0; x <= size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y <= size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
    // Major gridlines every 6 inches
    final major = Paint()
      ..color = const Color(0x2500C8FF)
      ..strokeWidth = 1.0;
    for (double x = 0; x <= size.width; x += spacing * 6) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), major);
    }
    for (double y = 0; y <= size.height; y += spacing * 6) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), major);
    }
  }

  void _drawInstructions(Canvas canvas, Size size) {
    final tp = TextPainter(
      text: const TextSpan(
        text: 'Tap to place vertices\nTap near first vertex to close',
        style: TextStyle(color: Color(0x88FFFFFF), fontSize: 15),
      ),
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
    )..layout(maxWidth: size.width - 48);
    tp.paint(canvas, Offset((size.width - tp.width) / 2, (size.height - tp.height) / 2));
  }

  void _drawPolygon(Canvas canvas, Size size) {
    final n = points.length;
    if (n < 2) return;

    final fillPaint = Paint()
      ..color = isClosed
          ? primaryColor.withOpacity(0.12)
          : const Color(0x00000000)
      ..style = PaintingStyle.fill;

    final strokePaint = Paint()
      ..color = primaryColor
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    final path = Path()..moveTo(points[0].dx, points[0].dy);
    for (int i = 1; i < n; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    if (isClosed) path.close();

    canvas.drawPath(path, fillPaint);
    canvas.drawPath(path, strokePaint);
  }

  void _drawVertices(Canvas canvas) {
    final fill = Paint()..color = primaryColor;
    final snap = Paint()
      ..color = Colors.greenAccent
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;

    for (int i = 0; i < points.length; i++) {
      final p = points[i];
      canvas.drawCircle(p, 5, fill);
      if (i == 0 && points.length >= 3 && !isClosed) {
        canvas.drawCircle(p, _kSnapRadius, snap);
      }
    }
  }

  void _drawRubberBand(Canvas canvas) {
    final paint = Paint()
      ..color = primaryColor.withOpacity(0.5)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    final path = Path()
      ..moveTo(points.last.dx, points.last.dy)
      ..lineTo(rubberBand!.dx, rubberBand!.dy);
    // Dashed rubber-band line
    final dashPaint = Paint()
      ..color = primaryColor.withOpacity(0.55)
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;
    _drawDashedLine(canvas, points.last, rubberBand!, dashPaint);

    // Show length callout near finger
    final len = (points.last - rubberBand!).distance / ppi;
    _drawLabel(canvas, rubberBand! + const Offset(10, -16),
        '${len.toStringAsFixed(2)}"', secondaryColor);
  }

  void _drawDimensions(Canvas canvas) {
    final n = points.length;
    for (int i = 0; i < n; i++) {
      final a = points[i];
      final b = points[(i + 1) % n];
      final mid = Offset((a.dx + b.dx) / 2, (a.dy + b.dy) / 2);

      // Outward normal offset for the label
      final dx = b.dx - a.dx;
      final dy = b.dy - a.dy;
      final len = math.sqrt(dx * dx + dy * dy);
      if (len == 0) continue;
      final nx = -dy / len;
      final ny = dx / len;
      final labelPos = Offset(mid.dx + nx * 18, mid.dy + ny * 18);

      final lenIn = len / ppi;
      final lenMm = lenIn * 25.4;
      final label = 'P${i + 1}: ${lenIn.toStringAsFixed(2)}" / ${lenMm.toStringAsFixed(1)}mm';
      _drawLabel(canvas, labelPos, label, secondaryColor, fontSize: 10);
    }
  }

  static void _drawDashedLine(Canvas canvas, Offset a, Offset b, Paint paint) {
    const dashLen = 6.0;
    const gapLen = 4.0;
    final dx = b.dx - a.dx;
    final dy = b.dy - a.dy;
    final total = math.sqrt(dx * dx + dy * dy);
    if (total == 0) return;
    final ux = dx / total;
    final uy = dy / total;
    double d = 0;
    bool drawing = true;
    while (d < total) {
      final segLen = drawing ? dashLen : gapLen;
      final end = math.min(d + segLen, total);
      if (drawing) {
        canvas.drawLine(
          Offset(a.dx + ux * d, a.dy + uy * d),
          Offset(a.dx + ux * end, a.dy + uy * end),
          paint,
        );
      }
      d = end;
      drawing = !drawing;
    }
  }

  static void _drawLabel(Canvas canvas, Offset pos, String text, Color color,
      {double fontSize = 11}) {
    final tp = TextPainter(
      text: TextSpan(
          text: text,
          style: TextStyle(
            color: color,
            fontSize: fontSize,
            fontWeight: FontWeight.bold,
            shadows: const [Shadow(color: Colors.black, blurRadius: 3)],
          )),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, pos - Offset(tp.width / 2, tp.height / 2));
  }

  @override
  bool shouldRepaint(_DrawPainter old) =>
      old.points != points ||
      old.isClosed != isClosed ||
      old.rubberBand != rubberBand ||
      old.ppi != ppi;
}

// ─── small param chip widget ─────────────────────────────────────────────────
class _ParamChip extends StatelessWidget {
  final String label;
  final String value;
  final VoidCallback onTap;
  const _ParamChip({required this.label, required this.value, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: cs.primary),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text('$label: $value',
            style: TextStyle(color: cs.primary, fontSize: 11, fontWeight: FontWeight.bold)),
      ),
    );
  }
}

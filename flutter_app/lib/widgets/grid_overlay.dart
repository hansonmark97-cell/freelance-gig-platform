import 'package:flutter/material.dart';

/// Grid overlay widget drawn with CustomPainter.
/// Renders a 1-inch (or metric) grid on top of the camera preview
/// to help users align the reference object and part.
class GridOverlay extends StatelessWidget {
  /// Spacing between grid lines in logical pixels.
  final double gridSpacing;

  /// Grid line color.
  final Color color;

  const GridOverlay({
    super.key,
    this.gridSpacing = 50.0,
    this.color = const Color(0x3300C8FF),  // semi-transparent blueprint blue
  });

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: CustomPaint(
        painter: _GridPainter(gridSpacing: gridSpacing, color: color),
        size: Size.infinite,
      ),
    );
  }
}

class _GridPainter extends CustomPainter {
  final double gridSpacing;
  final Color color;

  const _GridPainter({required this.gridSpacing, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 0.5;

    // Vertical lines
    for (double x = 0; x <= size.width; x += gridSpacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }

    // Horizontal lines
    for (double y = 0; y <= size.height; y += gridSpacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }

    // Centre crosshair
    final crossPaint = Paint()
      ..color = color.withOpacity(0.8)
      ..strokeWidth = 1.5;
    final cx = size.width / 2;
    final cy = size.height / 2;
    canvas.drawLine(Offset(cx - 20, cy), Offset(cx + 20, cy), crossPaint);
    canvas.drawLine(Offset(cx, cy - 20), Offset(cx, cy + 20), crossPaint);
  }

  @override
  bool shouldRepaint(_GridPainter old) =>
      old.gridSpacing != gridSpacing || old.color != color;
}

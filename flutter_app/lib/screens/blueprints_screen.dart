import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'draw_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// BlueprintsScreen — library of preloaded welding project templates.
//
// Each blueprint defines a polygon outline in world-inch coordinates.
// Tapping a card opens DrawScreen with the shape pre-filled and closed,
// ready to scale, review, and export.
// ─────────────────────────────────────────────────────────────────────────────

@immutable
class _WeldBlueprint {
  final String name;
  final String emoji;
  final String description;
  final String difficulty; // 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
  final String material;
  final double thicknessMm;
  final double ppi; // display pixels-per-inch for the canvas
  final int priceUsd; // 0 = free
  final List<Offset> pointsIn; // polygon vertices in world-inch coords

  const _WeldBlueprint({
    required this.name,
    required this.emoji,
    required this.description,
    required this.difficulty,
    required this.material,
    required this.thicknessMm,
    required this.ppi,
    required this.priceUsd,
    required this.pointsIn,
  });
}

// ─── Blueprint definitions ────────────────────────────────────────────────────

const _blueprints = <_WeldBlueprint>[
  // ── 1. Fire Pit Ring (24" octagon) ────────────────────────────────────────
  _WeldBlueprint(
    name: 'FIRE PIT RING',
    emoji: '🔥',
    description: '24" octagon top ring for a round fire pit',
    difficulty: 'BEGINNER',
    material: 'Mild Steel',
    thicknessMm: 6.0,
    ppi: 10.0,
    priceUsd: 0,
    pointsIn: [
      Offset(24.0, 12.0),
      Offset(20.5, 20.5),
      Offset(12.0, 24.0),
      Offset(3.5, 20.5),
      Offset(0.0, 12.0),
      Offset(3.5, 3.5),
      Offset(12.0, 0.0),
      Offset(20.5, 3.5),
    ],
  ),

  // ── 2. Sawhorse Leg (trapezoid) ────────────────────────────────────────────
  _WeldBlueprint(
    name: 'SAWHORSE LEG',
    emoji: '🪚',
    description: '42" base trapezoid leg — cut 4 for a full sawhorse',
    difficulty: 'BEGINNER',
    material: 'Mild Steel',
    thicknessMm: 3.0,
    ppi: 6.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 0.0),
      Offset(42.0, 0.0),
      Offset(36.0, 28.0),
      Offset(6.0, 28.0),
    ],
  ),

  // ── 3. Welding Cart Top Frame (24×18" rectangle) ──────────────────────────
  _WeldBlueprint(
    name: 'CART TOP FRAME',
    emoji: '🛒',
    description: '24"×18" welding cart or work table top',
    difficulty: 'BEGINNER',
    material: 'Mild Steel',
    thicknessMm: 3.0,
    ppi: 10.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 0.0),
      Offset(24.0, 0.0),
      Offset(24.0, 18.0),
      Offset(0.0, 18.0),
    ],
  ),

  // ── 4. BBQ Grill Side Panel (hexagon) ─────────────────────────────────────
  _WeldBlueprint(
    name: 'BBQ GRILL SIDE',
    emoji: '🍖',
    description: '30"×22" barrel BBQ grill side plate with slanted bottom',
    difficulty: 'INTERMEDIATE',
    material: 'Mild Steel',
    thicknessMm: 3.0,
    ppi: 8.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 8.0),
      Offset(6.0, 0.0),
      Offset(24.0, 0.0),
      Offset(30.0, 8.0),
      Offset(30.0, 22.0),
      Offset(0.0, 22.0),
    ],
  ),

  // ── 5. Shelf Bracket / L-Bracket ──────────────────────────────────────────
  _WeldBlueprint(
    name: 'SHELF BRACKET',
    emoji: '📦',
    description: '16"×14" L-shaped shelf wall bracket',
    difficulty: 'BEGINNER',
    material: 'Mild Steel',
    thicknessMm: 4.0,
    ppi: 16.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 0.0),
      Offset(16.0, 0.0),
      Offset(16.0, 2.0),
      Offset(2.0, 2.0),
      Offset(2.0, 14.0),
      Offset(0.0, 14.0),
    ],
  ),

  // ── 6. Pipe V-Stand Bracket ───────────────────────────────────────────────
  _WeldBlueprint(
    name: 'PIPE V-STAND',
    emoji: '🔩',
    description: '10"×8" V-notch bracket for holding round pipe/tube',
    difficulty: 'INTERMEDIATE',
    material: 'Mild Steel',
    thicknessMm: 6.0,
    ppi: 24.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 0.0),
      Offset(10.0, 0.0),
      Offset(10.0, 2.0),
      Offset(6.5, 7.0),
      Offset(5.0, 5.5),
      Offset(3.5, 7.0),
      Offset(0.0, 2.0),
    ],
  ),

  // ── 7. Trailer Tongue (tapered plate) ─────────────────────────────────────
  _WeldBlueprint(
    name: 'TRAILER TONGUE',
    emoji: '🚛',
    description: '48" tapered trailer tongue plate — 18" rear, 8" front',
    difficulty: 'INTERMEDIATE',
    material: 'Mild Steel',
    thicknessMm: 6.0,
    ppi: 5.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 5.0),
      Offset(48.0, 0.0),
      Offset(48.0, 8.0),
      Offset(0.0, 13.0),
    ],
  ),

  // ── 8. Corner Gusset (right-triangle) ────────────────────────────────────
  _WeldBlueprint(
    name: 'CORNER GUSSET',
    emoji: '📐',
    description: '8"×8" right-triangle corner gusset plate',
    difficulty: 'BEGINNER',
    material: 'Mild Steel',
    thicknessMm: 6.0,
    ppi: 30.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 0.0),
      Offset(8.0, 0.0),
      Offset(0.0, 8.0),
    ],
  ),

  // ── 9. Tube Frame Gusset (A-Frame / triangle with base notch) ─────────────
  _WeldBlueprint(
    name: 'A-FRAME GUSSET',
    emoji: '🏗️',
    description: '36" base A-frame panel for stands, gates, or racks',
    difficulty: 'INTERMEDIATE',
    material: 'Mild Steel',
    thicknessMm: 4.0,
    ppi: 7.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 0.0),
      Offset(36.0, 0.0),
      Offset(30.0, 4.0),
      Offset(18.0, 32.0),
      Offset(6.0, 4.0),
    ],
  ),

  // ── 10. Steel Workbench Top (48×30" rectangle) ────────────────────────────
  _WeldBlueprint(
    name: 'WORKBENCH TOP',
    emoji: '🔧',
    description: '48"×30" steel workbench top — weld angle iron frame',
    difficulty: 'INTERMEDIATE',
    material: 'Mild Steel',
    thicknessMm: 3.0,
    ppi: 5.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 0.0),
      Offset(48.0, 0.0),
      Offset(48.0, 30.0),
      Offset(0.0, 30.0),
    ],
  ),

  // ── 11. Angle Iron Bracket (L-profile cross-section) ─────────────────────
  _WeldBlueprint(
    name: 'ANGLE IRON BRACKET',
    emoji: '📏',
    description: '8"×8"×1.5" angle iron bracket — common structural piece',
    difficulty: 'BEGINNER',
    material: 'Mild Steel',
    thicknessMm: 6.0,
    ppi: 28.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 0.0),
      Offset(8.0, 0.0),
      Offset(8.0, 1.5),
      Offset(1.5, 1.5),
      Offset(1.5, 8.0),
      Offset(0.0, 8.0),
    ],
  ),

  // ── 12. Weld-On Hinge Plate ───────────────────────────────────────────────
  _WeldBlueprint(
    name: 'HINGE PLATE',
    emoji: '🚪',
    description: '6"×4" rectangular hinge plate with PIN hole allowance',
    difficulty: 'BEGINNER',
    material: 'Mild Steel',
    thicknessMm: 6.0,
    ppi: 40.0,
    priceUsd: 0,
    pointsIn: [
      Offset(0.0, 0.0),
      Offset(6.0, 0.0),
      Offset(6.0, 4.0),
      Offset(0.0, 4.0),
    ],
  ),
];

// ─── Screen ───────────────────────────────────────────────────────────────────

class BlueprintsScreen extends StatelessWidget {
  const BlueprintsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      backgroundColor: cs.background,
      appBar: AppBar(
        backgroundColor: cs.surface,
        title: const Text('PROJECT BLUEPRINTS'),
        foregroundColor: cs.primary,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(36),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Text(
              'Tap any project to load it on the drawing canvas',
              style: TextStyle(color: cs.secondary, fontSize: 11),
            ),
          ),
        ),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(12),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: 0.80,
        ),
        itemCount: _blueprints.length,
        itemBuilder: (ctx, i) => _BlueprintCard(blueprint: _blueprints[i]),
      ),
    );
  }
}

// ─── Card ────────────────────────────────────────────────────────────────────

class _BlueprintCard extends StatelessWidget {
  final _WeldBlueprint blueprint;
  const _BlueprintCard({super.key, required this.blueprint});

  Color _diffColor(String d) {
    if (d == 'BEGINNER') return Colors.greenAccent;
    if (d == 'INTERMEDIATE') return Colors.orangeAccent;
    return Colors.redAccent;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final dc = _diffColor(blueprint.difficulty);

    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => DrawScreen(
            initialPointsIn: blueprint.pointsIn,
            initialPpi: blueprint.ppi,
            title: blueprint.name,
            initialThicknessMm: blueprint.thicknessMm,
          ),
        ),
      ),
      child: Container(
        decoration: BoxDecoration(
          color: cs.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: cs.primary.withOpacity(0.35)),
        ),
        child: Column(
          children: [
            // 2D shape preview
            Expanded(
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
                child: Container(
                  color: const Color(0xFF0D0D0D),
                  child: CustomPaint(
                    painter: _ShapePreviewPainter(
                      points: blueprint.pointsIn,
                      primaryColor: cs.primary,
                    ),
                    child: const SizedBox.expand(),
                  ),
                ),
              ),
            ),

            // Card info
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Text(blueprint.emoji,
                          style: const TextStyle(fontSize: 14)),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          blueprint.name,
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 11),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    blueprint.description,
                    style: TextStyle(
                        color: cs.onSurface.withOpacity(0.45), fontSize: 9),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: dc.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: dc.withOpacity(0.5)),
                        ),
                        child: Text(
                          blueprint.difficulty,
                          style: TextStyle(
                              color: dc,
                              fontSize: 8,
                              fontWeight: FontWeight.bold),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        blueprint.priceUsd == 0
                            ? 'FREE'
                            : '\$${blueprint.priceUsd}',
                        style: TextStyle(
                          color: blueprint.priceUsd == 0
                              ? Colors.greenAccent
                              : cs.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Shape preview painter ────────────────────────────────────────────────────

class _ShapePreviewPainter extends CustomPainter {
  final List<Offset> points;
  final Color primaryColor;

  const _ShapePreviewPainter(
      {required this.points, required this.primaryColor});

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;

    // Compute bounding box
    double minX = points[0].dx, maxX = points[0].dx;
    double minY = points[0].dy, maxY = points[0].dy;
    for (final p in points) {
      minX = math.min(minX, p.dx);
      maxX = math.max(maxX, p.dx);
      minY = math.min(minY, p.dy);
      maxY = math.max(maxY, p.dy);
    }
    final shapeW = maxX - minX;
    final shapeH = maxY - minY;
    if (shapeW == 0 && shapeH == 0) return;

    const pad = 14.0;
    final scale = shapeH == 0
        ? (size.width - pad * 2) / shapeW
        : shapeW == 0
            ? (size.height - pad * 2) / shapeH
            : math.min(
                (size.width - pad * 2) / shapeW,
                (size.height - pad * 2) / shapeH);
    final offX = (size.width - shapeW * scale) / 2 - minX * scale;
    final offY = (size.height - shapeH * scale) / 2 - minY * scale;

    Offset s(Offset p) => Offset(p.dx * scale + offX, p.dy * scale + offY);
    final screenPts = points.map(s).toList();

    final path = Path()..moveTo(screenPts[0].dx, screenPts[0].dy);
    for (int i = 1; i < screenPts.length; i++) {
      path.lineTo(screenPts[i].dx, screenPts[i].dy);
    }
    path.close();

    // Fill
    canvas.drawPath(
      path,
      Paint()
        ..color = primaryColor.withOpacity(0.12)
        ..style = PaintingStyle.fill,
    );
    // Stroke
    canvas.drawPath(
      path,
      Paint()
        ..color = primaryColor
        ..strokeWidth = 1.5
        ..style = PaintingStyle.stroke,
    );
    // Vertices
    final vPaint = Paint()..color = primaryColor;
    for (final p in screenPts) {
      canvas.drawCircle(p, 2.5, vPaint);
    }
  }

  @override
  bool shouldRepaint(_ShapePreviewPainter old) => false;
}

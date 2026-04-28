import 'package:flutter/material.dart';
import 'camera_screen.dart';
import 'draw_screen.dart';
import 'blueprints_screen.dart';
import 'welder_tools_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: cs.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ── Logo ──────────────────────────────────────────────────────
              const SizedBox(height: 12),
              Icon(Icons.document_scanner_rounded, size: 72, color: cs.primary),
              const SizedBox(height: 12),
              Text(
                'WeldScan 3D',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.bold,
                  color: cs.primary,
                  letterSpacing: 2,
                ),
              ),
              Text(
                'Photo → Blueprint → Cut List',
                textAlign: TextAlign.center,
                style: TextStyle(color: cs.secondary, fontSize: 13),
              ),
              const SizedBox(height: 28),

              // ── Photo Scan ────────────────────────────────────────────────
              FilledButton.icon(
                icon: const Icon(Icons.add_a_photo_rounded, size: 26),
                label: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 13),
                  child: Text(
                    'NEW PROJECT  (PHOTO SCAN)',
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5),
                  ),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: cs.primary,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const CameraScreen())),
              ),
              const SizedBox(height: 10),

              // ── Draw Shape ────────────────────────────────────────────────
              OutlinedButton.icon(
                icon: const Icon(Icons.gesture_rounded, size: 24),
                label: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'DRAW SHAPE  →  3D BLUEPRINT',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2),
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  foregroundColor: cs.secondary,
                  side: BorderSide(color: cs.secondary, width: 1.5),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => Navigator.push(context,
                    MaterialPageRoute(builder: (_) => const DrawScreen())),
              ),
              const SizedBox(height: 10),

              // ── Blueprints + Welder Tools (side by side) ──────────────────
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.folder_special_rounded, size: 20),
                      label: const Padding(
                        padding: EdgeInsets.symmetric(vertical: 11),
                        child: Text('BLUEPRINTS',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1)),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: cs.primary,
                        side: BorderSide(
                            color: cs.primary.withOpacity(0.6), width: 1.5),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const BlueprintsScreen())),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.build_rounded, size: 20),
                      label: const Padding(
                        padding: EdgeInsets.symmetric(vertical: 11),
                        child: Text('WELDER TOOLS',
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1)),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: cs.primary,
                        side: BorderSide(
                            color: cs.primary.withOpacity(0.6), width: 1.5),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => const WelderToolsScreen())),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // ── Feature chips ─────────────────────────────────────────────
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 6,
                children: const [
                  _Chip('📷 Front & Rear Camera'),
                  _Chip('✏️ Finger-Draw Mode'),
                  _Chip('📚 Preloaded Blueprints'),
                  _Chip('🔄 3D Finger-Drag Viewer'),
                  _Chip('📐 Auto Dimensions'),
                  _Chip('🔩 Kerf Adjust'),
                  _Chip('📏 Miter Angles'),
                  _Chip('🔧 Weld Volume Calc'),
                  _Chip('⚡ Electrode Guide'),
                  _Chip('🌡️ Preheat Chart'),
                  _Chip('📄 PDF Blueprint'),
                  _Chip('⚙️ DXF / CNC Export'),
                ],
              ),
              const SizedBox(height: 20),

              Text(
                'Free: view all dimensions  •  \$2.99: PDF  •  \$9.99: DXF',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: cs.onSurface.withOpacity(0.4), fontSize: 11),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  const _Chip(this.label);

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label, style: const TextStyle(fontSize: 11)),
      backgroundColor: const Color(0xFF2A2A2A),
      side: BorderSide.none,
      padding: const EdgeInsets.symmetric(horizontal: 2),
    );
  }
}

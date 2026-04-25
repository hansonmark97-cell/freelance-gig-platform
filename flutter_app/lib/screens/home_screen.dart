import 'package:flutter/material.dart';
import 'camera_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: cs.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Logo / title area
              const SizedBox(height: 24),
              Icon(Icons.document_scanner_rounded, size: 80, color: cs.primary),
              const SizedBox(height: 16),
              Text(
                'WeldScan 3D',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: cs.primary,
                  letterSpacing: 2,
                ),
              ),
              Text(
                'Photo → Blueprint → Cut List',
                textAlign: TextAlign.center,
                style: TextStyle(color: cs.secondary, fontSize: 14),
              ),
              const Spacer(),

              // New Project button
              FilledButton.icon(
                icon: const Icon(Icons.add_a_photo_rounded, size: 28),
                label: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 14),
                  child: Text(
                    'NEW PROJECT',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                  ),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: cs.primary,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const CameraScreen()),
                ),
              ),
              const SizedBox(height: 16),

              // Feature chips
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: const [
                  _FeatureChip(label: '📐 Auto Dimensions'),
                  _FeatureChip(label: '🔩 Kerf Adjust'),
                  _FeatureChip(label: '📄 PDF Export'),
                  _FeatureChip(label: '⚙️ DXF / CNC'),
                  _FeatureChip(label: '📐 Miter Angles'),
                  _FeatureChip(label: '🔧 Weld Volume'),
                ],
              ),
              const SizedBox(height: 32),

              Text(
                'Free: view dimensions   •   \$2.99: PDF   •   \$9.99: DXF',
                textAlign: TextAlign.center,
                style: TextStyle(color: cs.onSurface.withOpacity(0.5), fontSize: 11),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeatureChip extends StatelessWidget {
  final String label;
  const _FeatureChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(label, style: const TextStyle(fontSize: 12)),
      backgroundColor: const Color(0xFF2A2A2A),
      side: BorderSide.none,
    );
  }
}

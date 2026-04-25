import 'dart:io';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import 'review_screen.dart';

class CalibrationScreen extends StatefulWidget {
  final File imageFile;
  const CalibrationScreen({super.key, required this.imageFile});

  @override
  State<CalibrationScreen> createState() => _CalibrationScreenState();
}

class _CalibrationScreenState extends State<CalibrationScreen> {
  final TextEditingController _sizeController =
      TextEditingController(text: '12');
  String _unit = 'inches';
  bool _isCalibrating = false;
  String? _error;

  // Known reference objects for quick selection
  static const _presets = [
    ('12" Square', '12', 'inches'),
    ('US Dollar Bill', '6.14', 'inches'),
    ('Credit Card', '3.37', 'inches'),
    ('US Quarter', '0.955', 'inches'),
    ('30cm Ruler', '11.81', 'inches'),
  ];

  Future<void> _calibrate() async {
    final size = double.tryParse(_sizeController.text);
    if (size == null || size <= 0) {
      setState(() => _error = 'Enter a valid reference size');
      return;
    }
    setState(() {
      _isCalibrating = true;
      _error = null;
    });

    try {
      final api = ApiService();
      final result = await api.calibrate(
        imageFile: widget.imageFile,
        refRealInches: _unit == 'mm' ? size / 25.4 : size,
      );

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => ReviewScreen(
            imageFile: widget.imageFile,
            sessionId: result['sessionId'] as String,
            ppi: (result['ppi'] as num).toDouble(),
          ),
        ),
      );
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isCalibrating = false;
      });
    }
  }

  @override
  void dispose() {
    _sizeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: cs.background,
      appBar: AppBar(
        backgroundColor: cs.surface,
        title: const Text('Calibrate Reference Object'),
        foregroundColor: cs.primary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Photo preview
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.file(widget.imageFile, height: 220, fit: BoxFit.cover),
            ),
            const SizedBox(height: 20),

            Text(
              'What is the reference object in your photo?',
              style: TextStyle(color: cs.secondary, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),

            // Presets
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: _presets.map((p) {
                return ActionChip(
                  label: Text(p.$1, style: const TextStyle(fontSize: 12)),
                  onPressed: () {
                    _sizeController.text = p.$2;
                    setState(() => _unit = p.$3);
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 20),

            // Custom size input
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: TextField(
                    controller: _sizeController,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: 'Reference size',
                      filled: true,
                      fillColor: cs.surface,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _unit,
                    dropdownColor: cs.surface,
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: cs.surface,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    items: const [
                      DropdownMenuItem(value: 'inches', child: Text('inches')),
                      DropdownMenuItem(value: 'mm', child: Text('mm')),
                    ],
                    onChanged: (v) => setState(() => _unit = v!),
                  ),
                ),
              ],
            ),

            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            ],
            const SizedBox(height: 24),

            FilledButton(
              onPressed: _isCalibrating ? null : _calibrate,
              style: FilledButton.styleFrom(
                backgroundColor: cs.primary,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: _isCalibrating
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                    )
                  : const Text('CALIBRATE & ANALYZE',
                      style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 1.2)),
            ),
          ],
        ),
      ),
    );
  }
}

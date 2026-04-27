import 'dart:io';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../widgets/three_d_viewer.dart';
import '../widgets/weld_symbol_picker.dart';
import 'export_screen.dart';

class ReviewScreen extends StatefulWidget {
  final File imageFile;
  final String sessionId;
  final double ppi;

  const ReviewScreen({
    super.key,
    required this.imageFile,
    required this.sessionId,
    required this.ppi,
  });

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  // Material params
  double _thicknessMm = 10.0;
  double _kerfMm = 1.5;
  double _wireDiameterMm = 0.9;
  double _weldLegMm = 10.0;
  String _kerfType = 'plasma';

  bool _isAnalyzing = false;
  Map<String, dynamic>? _analysisResult;
  String? _error;

  static const _kerfDefaults = {
    'plasma': 1.5,
    'laser': 0.3,
    'saw': 3.2,
  };

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _analyze();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _analyze() async {
    setState(() {
      _isAnalyzing = true;
      _error = null;
    });
    try {
      final api = ApiService();
      final result = await api.analyze(
        imageFile: widget.imageFile,
        sessionId: widget.sessionId,
        ppi: widget.ppi,
        thicknessMm: _thicknessMm,
        kerfMm: _kerfMm,
        wireDiameterMm: _wireDiameterMm,
        weldLegMm: _weldLegMm,
      );
      setState(() {
        _analysisResult = result;
        _isAnalyzing = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isAnalyzing = false;
      });
    }
  }

  void _showWeldSymbolPicker(int pieceIndex) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (_) => WeldSymbolPicker(
        onSelected: (symbol) {
          // In a real implementation, store selected symbol per joint
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('P${pieceIndex + 1}: $symbol weld selected')),
          );
          Navigator.pop(context);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final result = _analysisResult;

    return Scaffold(
      backgroundColor: cs.background,
      appBar: AppBar(
        backgroundColor: cs.surface,
        title: const Text('Blueprint Review'),
        foregroundColor: cs.primary,
        actions: [
          if (result != null)
            TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ExportScreen(
                    sessionId: widget.sessionId,
                    analysisResult: result,
                  ),
                ),
              ),
              child: Text('EXPORT', style: TextStyle(color: cs.primary, fontWeight: FontWeight.bold)),
            ),
        ],
        bottom: result != null
            ? TabBar(
                controller: _tabController,
                indicatorColor: cs.primary,
                labelColor: cs.primary,
                unselectedLabelColor: cs.onSurface.withOpacity(0.5),
                tabs: const [
                  Tab(icon: Icon(Icons.view_in_ar_rounded), text: '3D VIEW'),
                  Tab(icon: Icon(Icons.assignment_rounded), text: 'BLUEPRINT'),
                ],
              )
            : null,
      ),
      body: _isAnalyzing
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.redAccent)))
              : result == null
                  ? const SizedBox.shrink()
                  : _buildReviewBody(context, result, cs),
    );
  }

  Widget _buildReviewBody(
    BuildContext context,
    Map<String, dynamic> result,
    ColorScheme cs,
  ) {
    final summary = result['summary'] as Map<String, dynamic>;
    final welderCalcs = result['welderCalcs'] as Map<String, dynamic>;
    final cutList = result['cutList'] as List<dynamic>;
    final typedCutList = cutList
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();

    // Material params bar (shared across both tabs)
    final paramsBar = Container(
      color: cs.surface,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _ParamChip(
              label: 'Thickness',
              value: '${_thicknessMm.toStringAsFixed(0)}mm',
              onTap: () => _showNumberDialog('Metal thickness (mm)', _thicknessMm, (v) {
                setState(() => _thicknessMm = v);
                _analyze();
              }),
            ),
            const SizedBox(width: 8),
            _ParamChip(
              label: 'Kerf (${_kerfType})',
              value: '${_kerfMm.toStringAsFixed(1)}mm',
              onTap: () => _showKerfDialog(),
            ),
            const SizedBox(width: 8),
            _ParamChip(
              label: 'Wire Ø',
              value: '${_wireDiameterMm.toStringAsFixed(2)}mm',
              onTap: () => _showNumberDialog('Wire diameter (mm)', _wireDiameterMm, (v) {
                setState(() => _wireDiameterMm = v);
                _analyze();
              }),
            ),
            const SizedBox(width: 8),
            _ParamChip(
              label: 'Fillet leg',
              value: '${_weldLegMm.toStringAsFixed(0)}mm',
              onTap: () => _showNumberDialog('Fillet leg size (mm)', _weldLegMm, (v) {
                setState(() => _weldLegMm = v);
                _analyze();
              }),
            ),
          ],
        ),
      ),
    );

    return Column(
      children: [
        paramsBar,
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              // ── Tab 0: 3D View ─────────────────────────────────────────
              Container(
                color: const Color(0xFF0D0D0D),
                child: ThreeDViewer(
                  cutList: typedCutList,
                  thicknessMm: _thicknessMm,
                ),
              ),

              // ── Tab 1: Blueprint ───────────────────────────────────────
              SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Summary card
                    _SectionCard(
                      title: 'Dimensions',
                      child: Column(
                        children: [
                          _DimRow('Width', '${summary['bboxWidthIn']}"  (${summary['bboxWidthMm']} mm)'),
                          _DimRow('Height', '${summary['bboxHeightIn']}"  (${summary['bboxHeightMm']} mm)'),
                          _DimRow('Total cut length', '${summary['totalLengthMm']} mm'),
                          _DimRow('Total pieces', '${summary['totalPieces']}'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Welder calcs card
                    _SectionCard(
                      title: 'Welder Calculations',
                      child: Column(
                        children: [
                          _DimRow('Bend deduction', '${welderCalcs['bendDeductionMm']} mm'),
                          _DimRow('Root gap', '${welderCalcs['rootGapMm']} mm'),
                          _DimRow('Landing', '${welderCalcs['landingMm']} mm'),
                          _DimRow('Weld volume', '${welderCalcs['weldVolumeCm3']} cm³'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Cut list
                    _SectionCard(
                      title: 'Cut List  (tap piece to add weld symbol)',
                      child: Column(
                        children: [
                          const Row(
                            children: [
                              Expanded(flex: 1, child: Text('Piece', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                              Expanded(flex: 2, child: Text('Length', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                              Expanded(flex: 2, child: Text('Miter°', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                              Expanded(flex: 2, child: Text('Kerf-adj', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                            ],
                          ),
                          const Divider(),
                          ...cutList.asMap().entries.map((entry) {
                            final i = entry.key;
                            final chunk = entry.value as Map<String, dynamic>;
                            return InkWell(
                              onTap: () => _showWeldSymbolPicker(i),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 6),
                                child: Row(
                                  children: [
                                    Expanded(flex: 1, child: Text(chunk['label'] as String,
                                        style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold, fontSize: 12))),
                                    Expanded(flex: 2, child: Text('${chunk['lengthIn']}"', style: const TextStyle(fontSize: 12))),
                                    Expanded(flex: 2, child: Text('${chunk['miterDeg']}°', style: const TextStyle(fontSize: 12))),
                                    Expanded(flex: 2, child: Text('${chunk['kerfAdjLengthMm']}mm', style: const TextStyle(fontSize: 12))),
                                  ],
                                ),
                              ),
                            );
                          }),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
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
              if (v != null && v > 0) {
                onSave(v);
                Navigator.pop(context);
              }
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
        children: _kerfDefaults.entries.map((e) {
          return SimpleDialogOption(
            onPressed: () {
              setState(() {
                _kerfType = e.key;
                _kerfMm = e.value;
              });
              _analyze();
              Navigator.pop(context);
            },
            child: Text('${e.key}  (${e.value} mm kerf)'),
          );
        }).toList(),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String title;
  final Widget child;
  const _SectionCard({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: cs.secondary, fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _DimRow extends StatelessWidget {
  final String label;
  final String value;
  const _DimRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
        ],
      ),
    );
  }
}

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

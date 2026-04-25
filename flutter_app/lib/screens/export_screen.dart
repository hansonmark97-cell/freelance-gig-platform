import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/payment_service.dart';

class ExportScreen extends StatefulWidget {
  final String sessionId;
  final Map<String, dynamic> analysisResult;

  const ExportScreen({
    super.key,
    required this.sessionId,
    required this.analysisResult,
  });

  @override
  State<ExportScreen> createState() => _ExportScreenState();
}

class _ExportScreenState extends State<ExportScreen> {
  bool _loadingPdf = false;
  bool _loadingDxf = false;
  String? _error;

  Future<void> _exportPdf() async {
    setState(() {
      _loadingPdf = true;
      _error = null;
    });
    try {
      final paymentService = PaymentService();
      final api = ApiService();

      // 1. Create Stripe PaymentIntent
      final intent = await api.createExportPaymentIntent(
        sessionId: widget.sessionId,
        exportType: 'pdf',
        amountUsd: 2.99,
      );

      // 2. Present payment sheet
      await paymentService.presentPaymentSheet(
        clientSecret: intent['clientSecret'] as String,
      );

      // 3. Download file after payment
      await api.downloadExport(
        sessionId: widget.sessionId,
        exportType: 'pdf',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ PDF blueprint saved to Files')),
        );
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loadingPdf = false);
    }
  }

  Future<void> _exportDxf() async {
    setState(() {
      _loadingDxf = true;
      _error = null;
    });
    try {
      final paymentService = PaymentService();
      final api = ApiService();

      // 1. Create Stripe PaymentIntent
      final intent = await api.createExportPaymentIntent(
        sessionId: widget.sessionId,
        exportType: 'dxf',
        amountUsd: 9.99,
      );

      // 2. Present payment sheet
      await paymentService.presentPaymentSheet(
        clientSecret: intent['clientSecret'] as String,
      );

      // 3. Download file after payment
      await api.downloadExport(
        sessionId: widget.sessionId,
        exportType: 'dxf',
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ DXF file saved — ready for CNC plasma table')),
        );
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loadingDxf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final summary = widget.analysisResult['summary'] as Map<String, dynamic>;

    return Scaffold(
      backgroundColor: cs.background,
      appBar: AppBar(
        backgroundColor: cs.surface,
        title: const Text('Export Blueprint'),
        foregroundColor: cs.primary,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Free summary (always visible)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cs.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: cs.secondary.withOpacity(0.4)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Free Dimensions', style: TextStyle(color: cs.secondary, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  Text('Width:  ${summary['bboxWidthIn']}"  (${summary['bboxWidthMm']} mm)'),
                  Text('Height: ${summary['bboxHeightIn']}"  (${summary['bboxHeightMm']} mm)'),
                  Text('Pieces: ${summary['totalPieces']}'),
                  Text('Total cut: ${summary['totalLengthMm']} mm'),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // PDF export
            _ExportCard(
              icon: Icons.picture_as_pdf_rounded,
              iconColor: Colors.redAccent,
              title: 'PDF Blueprint',
              subtitle: 'Dimensioned drawing with cut list.\nPrint & take to the saw.',
              price: '\$2.99',
              isLoading: _loadingPdf,
              onTap: _exportPdf,
            ),
            const SizedBox(height: 16),

            // DXF export
            _ExportCard(
              icon: Icons.precision_manufacturing_rounded,
              iconColor: cs.secondary,
              title: 'DXF File (CNC)',
              subtitle: 'CNC-ready vector file for plasma tables\nand laser cutters.',
              price: '\$9.99',
              isLoading: _loadingDxf,
              onTap: _exportDxf,
            ),

            if (_error != null) ...[
              const SizedBox(height: 16),
              Text(_error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
            ],

            const SizedBox(height: 32),
            Text(
              'Payments powered by Stripe.\nOne-time charge — no subscription.',
              textAlign: TextAlign.center,
              style: TextStyle(color: cs.onSurface.withOpacity(0.4), fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExportCard extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final String price;
  final bool isLoading;
  final VoidCallback onTap;

  const _ExportCard({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.price,
    required this.isLoading,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return InkWell(
      onTap: isLoading ? null : onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: cs.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: cs.primary.withOpacity(0.5)),
        ),
        child: Row(
          children: [
            Icon(icon, color: iconColor, size: 40),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 4),
                  Text(subtitle,
                      style: TextStyle(color: cs.onSurface.withOpacity(0.6), fontSize: 12)),
                ],
              ),
            ),
            const SizedBox(width: 12),
            isLoading
                ? const SizedBox(
                    width: 24, height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: cs.primary,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(price,
                        style: const TextStyle(
                            color: Colors.black, fontWeight: FontWeight.bold)),
                  ),
          ],
        ),
      ),
    );
  }
}

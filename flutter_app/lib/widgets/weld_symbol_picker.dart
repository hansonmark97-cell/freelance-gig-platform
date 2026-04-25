import 'package:flutter/material.dart';

/// AWS-standard weld symbol types supported by WeldScan.
enum WeldSymbol {
  fillet('Fillet', '⌐', 'Equal-leg fillet weld (most common)'),
  butt('Butt (Square)', '||', 'Square-groove butt weld for thin stock'),
  vGroove('V-Groove', 'V', 'Full-penetration V-groove for thick plate'),
  jGroove('J-Groove', 'J', 'J-groove for one-sided access'),
  bevel('Bevel', '/', 'Single-bevel groove weld'),
  plug('Plug/Slot', '○', 'Plug or slot weld');

  final String label;
  final String symbol;
  final String description;
  const WeldSymbol(this.label, this.symbol, this.description);
}

/// Bottom-sheet picker for selecting a weld symbol to apply to a joint.
class WeldSymbolPicker extends StatelessWidget {
  final void Function(String symbolLabel) onSelected;

  const WeldSymbolPicker({super.key, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 12),
        Container(
          width: 40, height: 4,
          decoration: BoxDecoration(
            color: cs.onSurface.withOpacity(0.3),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
          child: Text(
            'Add Weld Symbol',
            style: TextStyle(
              color: cs.secondary,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ),
        ...WeldSymbol.values.map(
          (ws) => ListTile(
            leading: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: cs.primary.withOpacity(0.15),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: cs.primary.withOpacity(0.5)),
              ),
              alignment: Alignment.center,
              child: Text(
                ws.symbol,
                style: TextStyle(
                  color: cs.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
            title: Text(ws.label, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text(ws.description, style: const TextStyle(fontSize: 11)),
            onTap: () => onSelected(ws.label),
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}

import 'dart:math' as math;
import 'package:flutter/material.dart';

// ─────────────────────────────────────────────────────────────────────────────
// WelderToolsScreen — comprehensive welder reference & live calculators.
//
// Tabs:
//   1. ELECTRODES  — SMAW rod & MIG/TIG wire quick-reference table
//   2. CALCULATORS — live: heat input, deposition rate, IPM, preheat
//   3. JOINT TYPES — butt/fillet/lap/corner/T/edge with joint angles
//   4. SETTINGS    — MIG voltage/wire-speed guide by material + thickness
// ─────────────────────────────────────────────────────────────────────────────

class WelderToolsScreen extends StatelessWidget {
  const WelderToolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: cs.background,
        appBar: AppBar(
          backgroundColor: cs.surface,
          title: const Text('WELDER TOOLS'),
          foregroundColor: cs.primary,
          bottom: TabBar(
            labelColor: cs.primary,
            unselectedLabelColor: cs.onSurface.withOpacity(0.45),
            indicatorColor: cs.primary,
            labelStyle: const TextStyle(
                fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
            tabs: const [
              Tab(text: 'ELECTRODES'),
              Tab(text: 'CALCULATORS'),
              Tab(text: 'JOINTS'),
              Tab(text: 'MIG SETTINGS'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _ElectrodesTab(),
            _CalculatorsTab(),
            _JointsTab(),
            _MigSettingsTab(),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — ELECTRODES
// ─────────────────────────────────────────────────────────────────────────────

class _ElectrodesTab extends StatelessWidget {
  const _ElectrodesTab();

  static const _smaw = [
    _Rod('E6010', '75–125 A',  'DC+', 'F,V,OH,H', 'Mild steel — deep penetration, pipeline root passes, dirty metal'),
    _Rod('E6011', '75–125 A',  'AC/DC', 'F,V,OH,H', 'Mild steel — all-position, works on rusty/oily metal'),
    _Rod('E6013', '60–90 A',   'AC/DC+', 'F,V,OH,H', 'Mild steel — easy arc start, light fabrication, sheet metal'),
    _Rod('E7018', '100–165 A', 'DC+', 'F,V,OH,H', 'Mild steel — low-hydrogen, structural, high-strength welds'),
    _Rod('E7024', '200–300 A', 'AC/DC', 'F,H', 'Mild steel — flat/horiz only, very high deposition drag rod'),
    _Rod('E308L', '80–130 A',  'DC+', 'F,V,OH,H', '304/308 stainless steel — low carbon, general purpose'),
    _Rod('E309L', '80–130 A',  'DC+', 'F,V,OH,H', 'Dissimilar metal — stainless-to-mild steel joins'),
    _Rod('E316L', '80–130 A',  'DC+', 'F,V,OH,H', '316 stainless — chemical/marine corrosion resistance'),
  ];

  static const _mig = [
    _Rod('ER70S-6', '18–26 V / 200–400 in/min', 'C25 or CO₂', 'All',   'Mild steel — most common MIG wire, good for light rust/mill scale'),
    _Rod('ER308L',  '18–24 V / 150–350 in/min', 'Tri-mix/He', 'All',   '304 stainless — low carbon, general-purpose stainless MIG'),
    _Rod('ER309L',  '18–24 V / 150–300 in/min', 'Tri-mix',    'F,H',   'Stainless-to-mild overlay or dissimilar metal'),
    _Rod('ER316L',  '18–24 V / 150–300 in/min', 'Tri-mix',    'F,H',   '316 stainless — chemical/marine environments'),
    _Rod('ER4043',  '18–23 V / 200–400 in/min', 'Argon',      'All',   '6061/5052 aluminum — fluid, good wetting, lower hot cracking'),
    _Rod('ER5356',  '19–24 V / 200–450 in/min', 'Argon',      'All',   'Aluminum — higher strength, anodizes well'),
    _Rod('ER70S-2', '18–26 V / 200–400 in/min', 'C25 or Ar',  'All',   'Mild steel — triple-deox, excellent on clean base metal'),
  ];

  static const _tig = [
    _Rod('ER70S-2',  '80–200 A (DC-)', 'Argon',    'All', 'Mild & alloy steel TIG — cleanest rod, great for critical welds'),
    _Rod('ER308L',   '60–180 A (DC-)', 'Argon',    'All', '304 stainless TIG — low-carbon, standard food-grade fab'),
    _Rod('ER4043',   '60–180 A (AC)',  'Argon',    'All', 'Aluminum TIG — fluid, fewer hot cracks, grey anodize'),
    _Rod('ER5356',   '60–180 A (AC)',  'Argon',    'All', 'Aluminum TIG — higher strength, bright anodize'),
    _Rod('ERNiCr-3', '60–130 A (DC-)', 'Argon',    'All', 'Inconel / nickel alloy TIG — high-temp or dissimilar'),
    _Rod('ERTi-2',   '60–150 A (DC-)', 'Full-Argon','All','CP Titanium TIG — pure Ti, aerospace/medical'),
  ];

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        _SectionHeader('⚡ SMAW ELECTRODES (STICK)'),
        _rodTable(_smaw, cs, colLabel: 'Polarity'),
        const SizedBox(height: 20),
        _SectionHeader('🌀 MIG / GMAW WIRES'),
        _rodTable(_mig, cs, colLabel: 'Gas', mig: true),
        const SizedBox(height: 20),
        _SectionHeader('🔦 TIG / GTAW FILLER RODS'),
        _rodTable(_tig, cs, colLabel: 'Polarity'),
      ],
    );
  }

  Widget _rodTable(List<_Rod> rods, ColorScheme cs,
      {required String colLabel, bool mig = false}) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: cs.primary.withOpacity(0.25)),
      ),
      child: Column(
        children: rods.asMap().entries.map((e) {
          final i = e.key;
          final r = e.value;
          return Container(
            decoration: BoxDecoration(
              border: Border(
                top: i == 0
                    ? BorderSide.none
                    : BorderSide(color: cs.primary.withOpacity(0.1)),
              ),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(r.id,
                        style: TextStyle(
                            color: cs.primary,
                            fontWeight: FontWeight.bold,
                            fontSize: 13)),
                    const Spacer(),
                    Text(r.amps,
                        style: TextStyle(
                            color: cs.secondary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600)),
                  ],
                ),
                const SizedBox(height: 3),
                Row(
                  children: [
                    _PillBadge(label: colLabel + ': ' + r.polarity,
                        color: cs.primary),
                    const SizedBox(width: 6),
                    _PillBadge(label: 'Pos: ' + r.positions,
                        color: cs.secondary),
                  ],
                ),
                const SizedBox(height: 4),
                Text(r.use,
                    style: TextStyle(
                        color: cs.onSurface.withOpacity(0.55), fontSize: 11)),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}

@immutable
class _Rod {
  final String id, amps, polarity, positions, use;
  const _Rod(this.id, this.amps, this.polarity, this.positions, this.use);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — CALCULATORS
// ─────────────────────────────────────────────────────────────────────────────

class _CalculatorsTab extends StatefulWidget {
  const _CalculatorsTab();
  @override
  State<_CalculatorsTab> createState() => _CalculatorsTabState();
}

class _CalculatorsTabState extends State<_CalculatorsTab> {
  // Heat input
  final _hiAmps  = TextEditingController(text: '200');
  final _hiVolts = TextEditingController(text: '24');
  final _hiSpeed = TextEditingController(text: '12'); // in/min

  // Deposition rate
  final _drWFS = TextEditingController(text: '300'); // in/min
  final _drDia = TextEditingController(text: '0.035'); // wire dia in inches

  // Preheat
  final _phCE    = TextEditingController(text: '0.35');
  final _phThick = TextEditingController(text: '25'); // mm

  // Bend deduction
  final _bdRadius = TextEditingController(text: '10');
  final _bdThick  = TextEditingController(text: '6');

  // Weld volume
  final _wvLeg = TextEditingController(text: '8');
  final _wvLen = TextEditingController(text: '500');

  @override
  void dispose() {
    for (final c in [_hiAmps,_hiVolts,_hiSpeed,_drWFS,_drDia,
                     _phCE,_phThick,_bdRadius,_bdThick,_wvLeg,_wvLen]) {
      c.dispose();
    }
    super.dispose();
  }

  String _heatInput() {
    final a = double.tryParse(_hiAmps.text);
    final v = double.tryParse(_hiVolts.text);
    final s = double.tryParse(_hiSpeed.text);
    if (a == null || v == null || s == null || s <= 0) return '—';
    final hi = (a * v * 60) / (s * 1000);
    final cls = hi < 35 ? 'LOW' : hi < 65 ? 'MEDIUM' : 'HIGH';
    return '${hi.toStringAsFixed(2)} kJ/in   [$cls heat input]';
  }

  String _deposition() {
    final wfs = double.tryParse(_drWFS.text);
    final dia = double.tryParse(_drDia.text);
    if (wfs == null || dia == null || wfs <= 0 || dia <= 0) return '—';
    final areaIn2 = math.pi * math.pow(dia / 2, 2);
    final dr = wfs * areaIn2 * 60 * 0.284; // lb/hr (steel density 0.284 lb/in³)
    return '${dr.toStringAsFixed(3)} lb/hr  (${(dr * 453.6).toStringAsFixed(0)} g/hr)';
  }

  String _preheat() {
    final ce = double.tryParse(_phCE.text);
    final t  = double.tryParse(_phThick.text);
    if (ce == null || t == null || t <= 0) return '—';
    int tempF;
    String note;
    if (ce < 0.40) { tempF = 32;  note = 'No preheat required'; }
    else if (ce < 0.50) { tempF = t < 20 ? 32 : 150; note = tempF > 32 ? 'Low preheat' : 'No preheat'; }
    else if (ce < 0.60) { tempF = 300; note = 'Moderate preheat'; }
    else               { tempF = 400; note = 'High preheat required'; }
    final tempC = ((tempF - 32) * 5 / 9).round();
    return tempF > 32
        ? '${tempF}°F  (${tempC}°C)  —  $note'
        : 'None required  —  $note';
  }

  String _bendDeduction() {
    final r = double.tryParse(_bdRadius.text);
    final t = double.tryParse(_bdThick.text);
    if (r == null || t == null || r < 0 || t <= 0) return '—';
    final bd = (math.pi / 2) * (r + t / 3);
    return 'BD = ${bd.toStringAsFixed(3)} mm';
  }

  String _weldVolume() {
    final leg = double.tryParse(_wvLeg.text);
    final len = double.tryParse(_wvLen.text);
    if (leg == null || len == null || leg <= 0 || len <= 0) return '—';
    final area  = 0.5 * leg * leg;
    final volMm3 = area * len;
    final volCm3 = volMm3 / 1000;
    final volIn3 = volMm3 / 16387.064;
    return '${volCm3.toStringAsFixed(3)} cm³  |  ${volIn3.toStringAsFixed(4)} in³';
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        _CalcCard(
          title: '🔥 HEAT INPUT (AWS D1.1)',
          fields: [
            _CalcField('Amps (A)', _hiAmps),
            _CalcField('Volts (V)', _hiVolts),
            _CalcField('Travel speed (in/min)', _hiSpeed),
          ],
          result: _heatInput(),
          onChanged: () => setState(() {}),
        ),
        const SizedBox(height: 14),
        _CalcCard(
          title: '💧 DEPOSITION RATE (MIG)',
          fields: [
            _CalcField('Wire feed speed (in/min)', _drWFS),
            _CalcField('Wire diameter (in)  e.g. 0.035 / 0.045', _drDia),
          ],
          result: _deposition(),
          onChanged: () => setState(() {}),
        ),
        const SizedBox(height: 14),
        _CalcCard(
          title: '🌡️ PREHEAT TEMPERATURE',
          fields: [
            _CalcField('Carbon Equivalent (CE)  typical: 0.3–0.7', _phCE),
            _CalcField('Plate thickness (mm)', _phThick),
          ],
          result: _preheat(),
          onChanged: () => setState(() {}),
        ),
        const SizedBox(height: 14),
        _CalcCard(
          title: '📐 BEND DEDUCTION  BD = (π/2)×(r + t/3)',
          fields: [
            _CalcField('Inside bend radius (mm)', _bdRadius),
            _CalcField('Metal thickness (mm)', _bdThick),
          ],
          result: _bendDeduction(),
          onChanged: () => setState(() {}),
        ),
        const SizedBox(height: 14),
        _CalcCard(
          title: '🔷 FILLET WELD VOLUME  V = 0.5×leg²×length',
          fields: [
            _CalcField('Fillet leg size (mm)', _wvLeg),
            _CalcField('Weld run length (mm)', _wvLen),
          ],
          result: _weldVolume(),
          onChanged: () => setState(() {}),
        ),
        const SizedBox(height: 24),
        // CE reference
        _SectionHeader('📋 CARBON EQUIVALENT REFERENCE'),
        const SizedBox(height: 8),
        _textCard(cs, '''CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15

Typical values:
  A36 mild steel:    CE ≈ 0.25–0.40  → no preheat needed
  A572 Gr50:         CE ≈ 0.35–0.45  → preheat if > 1"
  4130 chromoly:     CE ≈ 0.55–0.65  → preheat 200–300°F
  A514 (T-1):        CE ≈ 0.55–0.70  → preheat 200–400°F
  Stainless 304:     CE ≈ 0.10–0.20  → no preheat
  Aluminum:          CE not applicable — warm to 150–250°F'''),
      ],
    );
  }

  Widget _textCard(ColorScheme cs, String text) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFF1A1A1A),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: cs.primary.withOpacity(0.2)),
    ),
    child: Text(text,
        style: TextStyle(
            color: cs.onSurface.withOpacity(0.7),
            fontSize: 12,
            fontFamily: 'monospace',
            height: 1.6)),
  );
}

@immutable
class _CalcField {
  final String label;
  final TextEditingController ctrl;
  const _CalcField(this.label, this.ctrl);
}

class _CalcCard extends StatelessWidget {
  final String title;
  final List<_CalcField> fields;
  final String result;
  final VoidCallback onChanged;

  const _CalcCard({
    required this.title,
    required this.fields,
    required this.result,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: cs.primary.withOpacity(0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  color: cs.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  letterSpacing: 0.5)),
          const SizedBox(height: 10),
          ...fields.map((f) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(f.label,
                    style: TextStyle(
                        color: cs.onSurface.withOpacity(0.5), fontSize: 11)),
                const SizedBox(height: 4),
                TextField(
                  controller: f.ctrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 8),
                    filled: true,
                    fillColor: const Color(0xFF252525),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: BorderSide.none),
                    focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: BorderSide(color: cs.primary, width: 1.5)),
                  ),
                  onChanged: (_) => onChanged(),
                ),
              ],
            ),
          )),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: cs.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: cs.primary.withOpacity(0.3)),
            ),
            child: Text(
              result,
              style: TextStyle(
                  color: cs.secondary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — JOINT TYPES
// ─────────────────────────────────────────────────────────────────────────────

class _JointsTab extends StatelessWidget {
  const _JointsTab();

  static const _joints = [
    _Joint(
      '⬛ BUTT JOINT',
      'Two pieces end-to-end in the same plane.\nGroove welds: V, bevel, U, J, square, double-V.',
      'Square groove: ≤3/16" (5 mm)\nSingle-V: 3/16" – 3/4"\nDouble-V: > 3/4"\nBevel angle: 60–75° total (30–37.5° each side)',
    ),
    _Joint(
      '🔺 FILLET / T-JOINT',
      'Two pieces at ~90°, weld applied at the junction.\nMost common joint in structural fabrication.',
      'Fillet leg = 0.7 × material thickness\nMin fillet: per AWS D1.1 Table 5.8\nMax single-pass: 5/16" (8 mm) flat\nFor full-pen T-joint: bevel one piece 45°',
    ),
    _Joint(
      '🔲 LAP JOINT',
      'Two pieces overlapping in the same plane.\nFillet weld on one or both edges.',
      'Min overlap: 5× plate thickness\nFillet size: match thinner plate thickness\nDouble-fillet preferred for loaded joints\nNot ideal for fatigue-loaded applications',
    ),
    _Joint(
      '📐 CORNER JOINT',
      'Two pieces meeting at a corner (outside or inside).\nCommon in box sections, frames, enclosures.',
      'Outside corner: full-pen or fillet\nInside corner: fillet weld\nFor thick plate: use open-corner with full bevel\nFlush: grind after welding for aesthetics',
    ),
    _Joint(
      '🔵 EDGE JOINT',
      'Two pieces with edges parallel, welded on the exposed edge.\nCommon in sheet metal, flanges, thin material.',
      'Best for material ≤ 1/4" (6 mm)\nMinimal strength — not for load-bearing\nOften a flanged joint when bent up\nMay be seal weld only',
    ),
    _Joint(
      '🔷 PLUG / SLOT WELD',
      'Hole or slot in one piece, filled with weld to attach to piece below.\nUsed when access to back side is blocked.',
      'Hole diameter ≥ 5/16" + material thickness\nMin edge distance: 1.5× hole diameter\nFill hole completely for plug weld\nSlot: width ≥ hole dia, length ≤ 10× thickness',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListView.separated(
      padding: const EdgeInsets.all(14),
      itemCount: _joints.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (ctx, i) {
        final j = _joints[i];
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: cs.primary.withOpacity(0.25)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(j.name,
                  style: TextStyle(
                      color: cs.primary,
                      fontWeight: FontWeight.bold,
                      fontSize: 14)),
              const SizedBox(height: 6),
              Text(j.description,
                  style: TextStyle(
                      color: cs.onSurface.withOpacity(0.75),
                      fontSize: 12,
                      height: 1.5)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: cs.secondary.withOpacity(0.07),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: cs.secondary.withOpacity(0.2)),
                ),
                child: Text(j.dimensions,
                    style: TextStyle(
                        color: cs.secondary,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        height: 1.6)),
              ),
            ],
          ),
        );
      },
    );
  }
}

@immutable
class _Joint {
  final String name, description, dimensions;
  const _Joint(this.name, this.description, this.dimensions);
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — MIG SETTINGS GUIDE
// ─────────────────────────────────────────────────────────────────────────────

class _MigSettingsTab extends StatelessWidget {
  const _MigSettingsTab();

  static const _settings = [
    _MigRow('0.024"', 'Mild steel', '20–22 V', '200–280 in/min', 'C25', '18–22 ga sheet'),
    _MigRow('0.030"', 'Mild steel', '20–23 V', '200–320 in/min', 'C25', '18 ga – 1/8"'),
    _MigRow('0.035"', 'Mild steel', '21–24 V', '200–380 in/min', 'C25', '16 ga – 1/4"'),
    _MigRow('0.045"', 'Mild steel', '23–26 V', '280–420 in/min', 'C25', '1/8" – 1/2"'),
    _MigRow('0.030"', '304 Stainless', '19–22 V', '180–300 in/min', 'Tri-mix', '18 ga – 1/8"'),
    _MigRow('0.035"', '304 Stainless', '20–23 V', '200–320 in/min', 'Tri-mix', '16 ga – 1/4"'),
    _MigRow('0.030"', 'Aluminum', '19–22 V', '300–400 in/min', 'Argon', '1/8" – 3/16"'),
    _MigRow('0.035"', 'Aluminum', '20–24 V', '300–450 in/min', 'Argon', '3/16" – 3/8"'),
    _MigRow('0.045"', 'Aluminum', '22–26 V', '350–500 in/min', 'Argon', '1/4" – 1/2"'),
  ];

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        _SectionHeader('MIG WIRE SETTINGS REFERENCE'),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: cs.primary.withOpacity(0.25)),
          ),
          child: Column(
            children: [
              // Header
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: cs.primary.withOpacity(0.12),
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(8)),
                ),
                child: Row(
                  children: [
                    _th(cs, 'Wire', flex: 2),
                    _th(cs, 'Material', flex: 3),
                    _th(cs, 'Volts', flex: 2),
                    _th(cs, 'WFS', flex: 3),
                    _th(cs, 'Gas', flex: 2),
                  ],
                ),
              ),
              // Rows
              ..._settings.asMap().entries.map((e) {
                final i = e.key;
                final r = e.value;
                return Container(
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(color: cs.primary.withOpacity(0.1)),
                    ),
                    color: i.isEven
                        ? Colors.transparent
                        : cs.primary.withOpacity(0.03),
                  ),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          _td(cs, r.wire, flex: 2, bold: true, color: cs.primary),
                          _td(cs, r.material, flex: 3),
                          _td(cs, r.volts, flex: 2),
                          _td(cs, r.wfs, flex: 3),
                          _td(cs, r.gas, flex: 2),
                        ],
                      ),
                      Padding(
                        padding: const EdgeInsets.only(top: 3, left: 2),
                        child: Text('Thickness: ${r.thickness}',
                            style: TextStyle(
                                color: cs.secondary,
                                fontSize: 10)),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _SectionHeader('💡 MIG TIPS'),
        const SizedBox(height: 8),
        _tipCard(cs, '🔧 Stick-out',
            '3/8" – 1/2" for solid wire. Longer stick-out = higher voltage, more spatter.'),
        _tipCard(cs, '🌬️ Gas flow',
            '20–25 CFH for indoor. Increase to 30–35 CFH outdoors or with drafts.'),
        _tipCard(cs, '⬆️ Travel angle',
            '5–15° push (forehand) for flat. 0–10° for vertical up. Pull (drag) only for flux-core.'),
        _tipCard(cs, '🔁 Polarity',
            'Solid wire: DC+ (DCEP). Flux-core self-shielded: DC- (DCEN). Always check wire datasheet.'),
        _tipCard(cs, '🪛 Contact tip',
            'Replace when arc becomes erratic. Use 0.030" tip for 0.030" wire (not +1 size).'),
        _tipCard(cs, '🏷️ Shielding gas',
            'C25 (75% Ar/25% CO₂) — best all-around for mild steel.\nPure CO₂ — deeper penetration, more spatter.\nTri-mix (He/Ar/CO₂) — stainless.\nPure Argon — aluminum only.'),
        const SizedBox(height: 20),
        _SectionHeader('⚡ WELD POSITION CODES'),
        const SizedBox(height: 8),
        _positionGrid(cs),
      ],
    );
  }

  Widget _th(ColorScheme cs, String label, {required int flex}) =>
      Expanded(
        flex: flex,
        child: Text(label,
            style: TextStyle(
                color: cs.primary,
                fontWeight: FontWeight.bold,
                fontSize: 10,
                letterSpacing: 0.5)),
      );

  Widget _td(ColorScheme cs, String val,
          {required int flex, bool bold = false, Color? color}) =>
      Expanded(
        flex: flex,
        child: Text(val,
            style: TextStyle(
                color: color ?? cs.onSurface.withOpacity(0.8),
                fontSize: 11,
                fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
      );

  Widget _tipCard(ColorScheme cs, String title, String body) => Container(
    margin: const EdgeInsets.only(bottom: 8),
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFF1A1A1A),
      borderRadius: BorderRadius.circular(8),
      border: Border.all(color: cs.primary.withOpacity(0.2)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title,
            style: TextStyle(
                color: cs.primary,
                fontWeight: FontWeight.bold,
                fontSize: 12)),
        const SizedBox(height: 4),
        Text(body,
            style: TextStyle(
                color: cs.onSurface.withOpacity(0.6),
                fontSize: 11,
                height: 1.5)),
      ],
    ),
  );

  Widget _positionGrid(ColorScheme cs) {
    const positions = [
      ('1G / 1F', 'FLAT', 'Plate lying flat, weld from above'),
      ('2G / 2F', 'HORIZ', 'Vertical plate, horizontal weld axis'),
      ('3G / 3F', 'VERT', 'Vertical plate, weld runs up or down'),
      ('4G / 4F', 'OVERHEAD', 'Plate above, weld upward into it'),
      ('5G',      'PIPE HORIZ', 'Pipe horizontal, fixed, weld all-around'),
      ('6G',      'PIPE 45°', 'Pipe at 45°, fixed — hardest, qualifies all'),
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: positions.map((p) => Container(
        width: 170,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A1A),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: cs.secondary.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(p.$1,
                style: TextStyle(
                    color: cs.secondary,
                    fontWeight: FontWeight.bold,
                    fontSize: 13)),
            Text(p.$2,
                style: const TextStyle(fontSize: 10, letterSpacing: 1)),
            const SizedBox(height: 4),
            Text(p.$3,
                style: TextStyle(
                    color: cs.onSurface.withOpacity(0.55), fontSize: 10)),
          ],
        ),
      )).toList(),
    );
  }
}

@immutable
class _MigRow {
  final String wire, material, volts, wfs, gas, thickness;
  const _MigRow(
      this.wire, this.material, this.volts, this.wfs, this.gas, this.thickness);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String text;
  const _SectionHeader(this.text);

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: cs.primary, width: 3)),
      ),
      child: Text(
        text,
        style: TextStyle(
            color: cs.secondary,
            fontWeight: FontWeight.bold,
            fontSize: 11,
            letterSpacing: 1.5),
      ),
    );
  }
}

class _PillBadge extends StatelessWidget {
  final String label;
  final Color color;
  const _PillBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      color: color.withOpacity(0.12),
      borderRadius: BorderRadius.circular(4),
      border: Border.all(color: color.withOpacity(0.4)),
    ),
    child: Text(label,
        style: TextStyle(
            color: color, fontSize: 9, fontWeight: FontWeight.bold)),
  );
}

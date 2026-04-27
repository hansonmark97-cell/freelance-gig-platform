import 'dart:io';
import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:sensors_plus/sensors_plus.dart';
import 'calibration_screen.dart';
import '../widgets/grid_overlay.dart';

class CameraScreen extends StatefulWidget {
  const CameraScreen({super.key});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen> with WidgetsBindingObserver {
  CameraController? _controller;
  List<CameraDescription>? _cameras;
  bool _isInitialized = false;
  double _roll = 0.0;   // tilt left/right
  double _pitch = 0.0;  // tilt forward/back

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera();
    _listenAccelerometer();
  }

  Future<void> _initCamera() async {
    _cameras = await availableCameras();
    if (_cameras == null || _cameras!.isEmpty) return;
    _controller = CameraController(_cameras!.first, ResolutionPreset.high);
    await _controller!.initialize();
    if (mounted) setState(() => _isInitialized = true);
  }

  void _listenAccelerometer() {
    accelerometerEventStream().listen((AccelerometerEvent e) {
      setState(() {
        _roll = e.x;
        _pitch = e.y;
      });
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _controller?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = _controller;
    if (state == AppLifecycleState.paused) {
      // Release camera when app moves to the background.
      if (controller != null && controller.value.isInitialized) {
        setState(() => _isInitialized = false);
        controller.dispose();
        _controller = null;
      }
    } else if (state == AppLifecycleState.resumed) {
      // Re-acquire camera when app comes back to foreground.
      _initCamera();
    }
  }

  Future<void> _capture() async {
    if (_controller == null || !_controller!.value.isInitialized) return;
    final XFile file = await _controller!.takePicture();
    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CalibrationScreen(imageFile: File(file.path)),
      ),
    );
  }

  Color get _levelColor {
    final deviation = (_roll.abs() + _pitch.abs()) / 2;
    if (deviation < 0.3) return Colors.greenAccent;
    if (deviation < 1.0) return Colors.orangeAccent;
    return Colors.redAccent;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Camera preview
          if (_isInitialized && _controller != null)
            CameraPreview(_controller!)
          else
            const Center(child: CircularProgressIndicator()),

          // Grid overlay
          const GridOverlay(),

          // Level indicator
          Positioned(
            top: 50,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Text(
                  _levelColor == Colors.greenAccent ? '✔ Level' : 'Tilt camera flat',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: _levelColor, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                _LevelBar(roll: _roll, pitch: _pitch, color: _levelColor),
              ],
            ),
          ),

          // Instruction overlay
          Positioned(
            bottom: 120,
            left: 24,
            right: 24,
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'Place a 12" square or ruler next to the part, then capture.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ),
          ),

          // Capture button
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Center(
              child: GestureDetector(
                onTap: _capture,
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: cs.primary, width: 4),
                    color: cs.primary.withOpacity(0.15),
                  ),
                  child: Icon(Icons.camera_alt_rounded, color: cs.primary, size: 36),
                ),
              ),
            ),
          ),

          // Back button
          Positioned(
            top: 44,
            left: 12,
            child: IconButton(
              icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white),
              onPressed: () => Navigator.pop(context),
            ),
          ),
        ],
      ),
    );
  }
}

class _LevelBar extends StatelessWidget {
  final double roll;
  final double pitch;
  final Color color;
  const _LevelBar({required this.roll, required this.pitch, required this.color});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 10,
      width: 200,
      child: CustomPaint(
        painter: _LevelBarPainter(roll: roll, color: color),
      ),
    );
  }
}

class _LevelBarPainter extends CustomPainter {
  final double roll;
  final Color color;
  const _LevelBarPainter({required this.roll, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final bg = Paint()..color = Colors.white24;
    canvas.drawRRect(
      RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(4)),
      bg,
    );
    // Indicator dot
    final cx = (size.width / 2) + (roll * size.width / 20).clamp(-size.width / 2, size.width / 2);
    final paint = Paint()..color = color;
    canvas.drawCircle(Offset(cx, size.height / 2), size.height / 2, paint);
  }

  @override
  bool shouldRepaint(_LevelBarPainter old) => old.roll != roll || old.color != color;
}

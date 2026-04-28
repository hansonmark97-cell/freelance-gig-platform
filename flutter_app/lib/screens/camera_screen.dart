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
  bool _isSwitching = false;
  int _cameraIndex = 0; // 0 = rear, 1 = front
  double _roll = 0.0;
  double _pitch = 0.0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initCamera(_cameraIndex);
    _listenAccelerometer();
  }

  Future<void> _initCamera(int index) async {
    _cameras = await availableCameras();
    if (_cameras == null || _cameras!.isEmpty) return;
    final idx = index.clamp(0, _cameras!.length - 1);
    _controller = CameraController(_cameras![idx], ResolutionPreset.high);
    await _controller!.initialize();
    if (mounted) setState(() { _isInitialized = true; _isSwitching = false; });
  }

  Future<void> _switchCamera() async {
    if (_cameras == null || _cameras!.length < 2 || _isSwitching) return;
    setState(() { _isInitialized = false; _isSwitching = true; });
    await _controller?.dispose();
    _controller = null;
    _cameraIndex = (_cameraIndex + 1) % _cameras!.length;
    await _initCamera(_cameraIndex);
  }

  void _listenAccelerometer() {
    accelerometerEventStream().listen((AccelerometerEvent e) {
      if (mounted) setState(() { _roll = e.x; _pitch = e.y; });
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
      if (controller != null && controller.value.isInitialized) {
        setState(() => _isInitialized = false);
        controller.dispose();
        _controller = null;
      }
    } else if (state == AppLifecycleState.resumed) {
      _initCamera(_cameraIndex);
    }
  }

  Future<void> _capture() async {
    if (_controller == null || !_controller!.value.isInitialized) return;
    final XFile file = await _controller!.takePicture();
    if (!mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => CalibrationScreen(imageFile: File(file.path))),
    );
  }

  Color get _levelColor {
    final deviation = (_roll.abs() + _pitch.abs()) / 2;
    if (deviation < 0.3) return Colors.greenAccent;
    if (deviation < 1.0) return Colors.orangeAccent;
    return Colors.redAccent;
  }

  bool get _hasFrontCamera => (_cameras?.length ?? 0) > 1;
  bool get _isUsingFront => _cameraIndex != 0;

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
            Center(child: CircularProgressIndicator(color: cs.primary)),

          // Grid overlay
          const GridOverlay(),

          // Level indicator
          Positioned(
            top: 50, left: 0, right: 0,
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

          // FRONT / REAR badge
          Positioned(
            top: 46, right: 64,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.black54, borderRadius: BorderRadius.circular(12)),
              child: Text(
                _isUsingFront ? '📸 FRONT' : '📷 REAR',
                style: TextStyle(color: cs.primary, fontSize: 11,
                    fontWeight: FontWeight.bold, letterSpacing: 1.5),
              ),
            ),
          ),

          // Instruction overlay
          Positioned(
            bottom: 130, left: 24, right: 24,
            child: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                  color: Colors.black54, borderRadius: BorderRadius.circular(8)),
              child: const Text(
                'Place a 12" square or ruler next to the part, then capture.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 13),
              ),
            ),
          ),

          // Capture + flip row
          Positioned(
            bottom: 40, left: 0, right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Flip camera button
                if (_hasFrontCamera)
                  Padding(
                    padding: const EdgeInsets.only(right: 32),
                    child: GestureDetector(
                      onTap: _switchCamera,
                      child: Container(
                        width: 52, height: 52,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.black54,
                          border: Border.all(color: Colors.white54, width: 1.5),
                        ),
                        child: _isSwitching
                            ? const Padding(
                                padding: EdgeInsets.all(14),
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.flip_camera_ios_rounded,
                                color: Colors.white, size: 26),
                      ),
                    ),
                  ),

                // Shutter button
                GestureDetector(
                  onTap: _capture,
                  child: Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: cs.primary, width: 4),
                      color: cs.primary.withOpacity(0.15),
                    ),
                    child: Icon(Icons.camera_alt_rounded, color: cs.primary, size: 36),
                  ),
                ),

                // Spacer to balance layout when flip button is shown
                if (_hasFrontCamera) const SizedBox(width: 84),
              ],
            ),
          ),

          // Back button
          Positioned(
            top: 44, left: 12,
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

import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

/// Base URL for the WeldScan backend.
/// Override with the deployed Cloud Run URL in production.
const String _baseUrl = String.fromEnvironment(
  'WELDSCAN_API_URL',
  defaultValue: 'http://localhost:3000/api/weldscan',
);

class ApiService {
  final String baseUrl;
  String? _authToken;

  ApiService({this.baseUrl = _baseUrl});

  void setAuthToken(String token) => _authToken = token;

  Map<String, String> get _headers => {
    'Content-Type': 'application/json',
    if (_authToken != null) 'Authorization': 'Bearer $_authToken',
  };

  // ---------------------------------------------------------------------------
  // POST /calibrate  (draw-mode synthetic calibration)
  // Creates a calibration session using a known PPI value without an image.
  // refPixelLength = ppi (i.e. 1 real inch = ppi pixels).
  // ---------------------------------------------------------------------------
  Future<Map<String, dynamic>> draftCalibrate({required double ppi}) async {
    final response = await http.post(
      Uri.parse('$baseUrl/calibrate'),
      headers: _headers,
      body: jsonEncode({
        'refPixelLength': ppi,
        'refRealInches': 1.0,
      }),
    );
    return _handleResponse(response);
  }

  // ---------------------------------------------------------------------------
  // POST /analyze  (draw-mode — pass segments directly, no image)
  // ---------------------------------------------------------------------------
  Future<Map<String, dynamic>> analyzeSegments({
    required String sessionId,
    required List<Map<String, dynamic>> segments,
    double thicknessMm = 10.0,
    double kerfMm = 1.5,
    double wireDiameterMm = 0.9,
    double insideRadiusMm = 10.0,
    double weldLegMm = 10.0,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/analyze'),
      headers: _headers,
      body: jsonEncode({
        'sessionId': sessionId,
        'segments': segments,
        'thicknessMm': thicknessMm,
        'kerfMm': kerfMm,
        'wireDiameterMm': wireDiameterMm,
        'insideRadiusMm': insideRadiusMm,
        'weldLegMm': weldLegMm,
      }),
    );
    return _handleResponse(response);
  }

  // ---------------------------------------------------------------------------
  // GET /export/pdf/download?sessionId=...
  // ---------------------------------------------------------------------------
  Future<File> downloadPdf({required String sessionId}) async {
    return downloadExport(sessionId: sessionId, exportType: 'pdf');
  }

  // ---------------------------------------------------------------------------
  // GET /export/dxf/download?sessionId=...
  // ---------------------------------------------------------------------------
  Future<File> downloadDxf({required String sessionId}) async {
    return downloadExport(sessionId: sessionId, exportType: 'dxf');
  }

  // ---------------------------------------------------------------------------
  // POST /calibrate
  // ---------------------------------------------------------------------------
  Future<Map<String, dynamic>> calibrate({
    required File imageFile,
    required double refRealInches,
  }) async {
    final bytes = await imageFile.readAsBytes();
    final b64 = base64Encode(bytes);

    // Send image dimensions alongside the base64 data
    final decoded = await _decodeImageDimensions(imageFile);

    final response = await http.post(
      Uri.parse('$baseUrl/calibrate'),
      headers: _headers,
      body: jsonEncode({
        'imageB64': b64,
        'refRealInches': refRealInches,
        'imageWidth': decoded['width'],
        'imageHeight': decoded['height'],
        // refPixelLength is detected server-side by the Python CV pipeline.
        // For the Node.js bridge, pass a placeholder that the backend resolves.
        'refPixelLength': decoded['width'],
      }),
    );

    return _handleResponse(response);
  }

  // ---------------------------------------------------------------------------
  // POST /analyze
  // ---------------------------------------------------------------------------
  Future<Map<String, dynamic>> analyze({
    required File imageFile,
    required String sessionId,
    required double ppi,
    double thicknessMm = 10.0,
    double kerfMm = 1.5,
    double wireDiameterMm = 0.9,
    double weldLegMm = 10.0,
  }) async {
    final bytes = await imageFile.readAsBytes();
    final b64 = base64Encode(bytes);

    final response = await http.post(
      Uri.parse('$baseUrl/analyze'),
      headers: _headers,
      body: jsonEncode({
        'sessionId': sessionId,
        'imageB64': b64,
        'ppi': ppi,
        'thicknessMm': thicknessMm,
        'kerfMm': kerfMm,
        'wireDiameterMm': wireDiameterMm,
        'weldLegMm': weldLegMm,
      }),
    );

    return _handleResponse(response);
  }

  // ---------------------------------------------------------------------------
  // POST /export/pdf  or  /export/dxf  — create Stripe PaymentIntent
  // ---------------------------------------------------------------------------
  Future<Map<String, dynamic>> createExportPaymentIntent({
    required String sessionId,
    required String exportType,  // 'pdf' or 'dxf'
    required double amountUsd,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/export/$exportType'),
      headers: _headers,
      body: jsonEncode({'sessionId': sessionId}),
    );

    return _handleResponse(response);
  }

  // ---------------------------------------------------------------------------
  // Download the exported file after payment confirmation
  // ---------------------------------------------------------------------------
  Future<File> downloadExport({
    required String sessionId,
    required String exportType,  // 'pdf' or 'dxf'
  }) async {
    final response = await http.get(
      Uri.parse('$baseUrl/export/$exportType/download?sessionId=$sessionId'),
      headers: _headers,
    );

    if (response.statusCode != 200) {
      throw Exception('Download failed: ${response.body}');
    }

    final dir = await getApplicationDocumentsDirectory();
    final ext = exportType == 'pdf' ? 'pdf' : 'dxf';
    final file = File('${dir.path}/weldscan_$sessionId.$ext');
    await file.writeAsBytes(response.bodyBytes);
    return file;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  Map<String, dynamic> _handleResponse(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    throw Exception(body['error'] ?? 'Request failed (${response.statusCode})');
  }

  Future<Map<String, int>> _decodeImageDimensions(File file) async {
    // Simple JPEG/PNG dimension reader — sufficient for passing to the server.
    // In production, use the `image` package for precise decoding.
    final bytes = await file.readAsBytes();
    int width = 1920;
    int height = 1080;

    if (bytes.length > 24) {
      // PNG: width at byte 16, height at byte 20
      if (bytes[0] == 0x89 && bytes[1] == 0x50) {
        width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
        height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
      }
    }

    return {'width': width, 'height': height};
  }
}

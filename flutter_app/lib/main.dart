import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'screens/home_screen.dart';
import 'services/api_service.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        Provider<ApiService>(create: (_) => ApiService()),
      ],
      child: const WeldScanApp(),
    ),
  );
}

class WeldScanApp extends StatelessWidget {
  const WeldScanApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WeldScan 3D',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFF6B00),   // welder orange
          secondary: Color(0xFF00C8FF), // blueprint blue
          surface: Color(0xFF1A1A1A),
          background: Color(0xFF0D0D0D),
        ),
        useMaterial3: true,
        fontFamily: 'RobotoMono',
      ),
      home: const HomeScreen(),
    );
  }
}

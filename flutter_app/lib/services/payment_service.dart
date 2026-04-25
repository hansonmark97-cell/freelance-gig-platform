import 'package:flutter/material.dart';
import 'package:flutter_stripe/flutter_stripe.dart';

/// Wraps Stripe Flutter SDK for one-time payment sheet presentation.
///
/// Setup:
///   1. Add your publishable key to your app initialization:
///      Stripe.publishableKey = 'pk_live_...';
///   2. Call presentPaymentSheet() with the clientSecret from your backend.
class PaymentService {
  /// Present the Stripe payment sheet and wait for the user to complete payment.
  ///
  /// Throws a [PaymentSheetCancelException] if the user cancels.
  /// Throws a [StripeException] on payment failure.
  Future<void> presentPaymentSheet({required String clientSecret}) async {
    // 1. Initialize the payment sheet
    await Stripe.instance.initPaymentSheet(
      paymentSheetData: SetupPaymentSheetParameters(
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'WeldScan 3D',
        style: ThemeMode.dark,
        appearance: const PaymentSheetAppearance(
          colors: PaymentSheetAppearanceColors(
            primary: Color(0xFFFF6B00),       // welder orange
            background: Color(0xFF1A1A1A),
            componentBackground: Color(0xFF2A2A2A),
          ),
        ),
      ),
    );

    // 2. Present it — throws on cancel or error
    await Stripe.instance.presentPaymentSheet();
  }
}


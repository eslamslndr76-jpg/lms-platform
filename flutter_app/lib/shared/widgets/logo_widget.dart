import 'package:flutter/material.dart';

/// Displays the platform logo from base64 (if provided by API branding)
/// or the bundled high-resolution asset `assets/images/app_logo.png`.
class LogoWidget extends StatelessWidget {
  final String logoBase64;
  final String fallbackText;
  final double size;

  const LogoWidget({
    super.key,
    required this.logoBase64,
    required this.fallbackText,
    this.size = 72,
  });

  @override
  Widget build(BuildContext context) {
    // 1. Try base64 from branding if present
    if (logoBase64.isNotEmpty && logoBase64.startsWith('data:image')) {
      try {
        return ClipRRect(
          borderRadius: BorderRadius.circular(size * 0.22),
          child: Image.memory(
            Uri.dataFromString(logoBase64).data!.contentAsBytes(),
            width: size,
            height: size,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => _buildAssetLogo(),
          ),
        );
      } catch (_) {
        return _buildAssetLogo();
      }
    }

    // 2. Default to bundled official asset logo
    return _buildAssetLogo();
  }

  Widget _buildAssetLogo() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.22),
      child: Image.asset(
        'assets/images/app_logo.png',
        width: size,
        height: size,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) => _fallback(Theme.of(context).colorScheme),
      ),
    );
  }

  Widget _fallback(ColorScheme cs) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [cs.primary, cs.secondary],
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
        ),
        borderRadius: BorderRadius.circular(size * 0.22),
        boxShadow: [
          BoxShadow(
            color: cs.primary.withValues(alpha: 0.35),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Icon(
        Icons.school_rounded,
        size: size * 0.55,
        color: cs.onPrimary,
      ),
    );
  }
}

import 'package:flutter/material.dart';

/// Displays the platform logo (base64 data URL) or a stylized fallback
/// with the first letter of the platform name inside a colored circle.
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
    final cs = Theme.of(context).colorScheme;

    if (logoBase64.isNotEmpty && logoBase64.startsWith('data:image')) {
      try {
        return ClipRRect(
          borderRadius: BorderRadius.circular(size * 0.22),
          child: Image.memory(
            Uri.dataFromString(logoBase64).data!.contentAsBytes(),
            width: size,
            height: size,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => _fallback(cs),
          ),
        );
      } catch (_) {
        return _fallback(cs);
      }
    }

    return _fallback(cs);
  }

  Widget _fallback(ColorScheme cs) {
    final letter = fallbackText.isNotEmpty ? fallbackText[0] : 'ت';
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
      child: Center(
        child: Text(
          letter,
          style: TextStyle(
            color: cs.onPrimary,
            fontSize: size * 0.44,
            fontWeight: FontWeight.w900,
            fontFamily: 'Cairo',
          ),
        ),
      ),
    );
  }
}

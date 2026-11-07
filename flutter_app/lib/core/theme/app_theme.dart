import 'package:flutter/material.dart';

/// Generates a full Material 3 ColorScheme from a single seed hex color.
/// Used to replicate the same branding that the web admin panel uses.
class AppTheme {
  AppTheme._();

  static const String fontFamily = 'Cairo'; // Arabic-supporting Google Font

  /// Light theme — built from the seed color and secondary fetched from /api/settings/branding
  static ThemeData light(Color seed, {Color? secondary}) {
    final scheme = ColorScheme.fromSeed(
      seedColor: seed,
      secondary: secondary,
      brightness: Brightness.light,
    );
    return _build(scheme);
  }

  /// Dark theme — same seed and secondary, dark variant
  static ThemeData dark(Color seed, {Color? secondary}) {
    final scheme = ColorScheme.fromSeed(
      seedColor: seed,
      secondary: secondary,
      brightness: Brightness.dark,
    );
    return _build(scheme);
  }

  static ThemeData _build(ColorScheme scheme) {
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      fontFamily: fontFamily,

      // ── AppBar ────────────────────────────────────────────────────────────
      appBarTheme: AppBarTheme(
        backgroundColor: scheme.surface,
        foregroundColor: scheme.onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: true,
        titleTextStyle: TextStyle(
          fontFamily: fontFamily,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: scheme.onSurface,
        ),
      ),

      // ── Cards ─────────────────────────────────────────────────────────────
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        color: scheme.surfaceContainerLow,
      ),

      // ── Filled Button ────────────────────────────────────────────────────
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),

      // ── Outlined Button ───────────────────────────────────────────────────
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // ── Text Button ───────────────────────────────────────────────────────
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: const TextStyle(
            fontFamily: fontFamily,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),

      // ── Input / TextField ─────────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.surfaceContainerHighest.withValues(alpha: 0.5),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.outlineVariant, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.error, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: scheme.error, width: 2),
        ),
        labelStyle: TextStyle(fontFamily: fontFamily, color: scheme.onSurfaceVariant),
        hintStyle: TextStyle(fontFamily: fontFamily, color: scheme.onSurfaceVariant.withValues(alpha: 0.7)),
      ),

      // ── Bottom Navigation ─────────────────────────────────────────────────
      navigationBarTheme: NavigationBarThemeData(
        indicatorColor: scheme.primaryContainer,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: scheme.onPrimaryContainer);
          }
          return IconThemeData(color: scheme.onSurfaceVariant);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final base = TextStyle(fontFamily: fontFamily, fontSize: 12);
          if (states.contains(WidgetState.selected)) {
            return base.copyWith(fontWeight: FontWeight.w700, color: scheme.onSurface);
          }
          return base.copyWith(fontWeight: FontWeight.w500, color: scheme.onSurfaceVariant);
        }),
      ),

      // ── Chip ──────────────────────────────────────────────────────────────
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        labelStyle: const TextStyle(fontFamily: fontFamily, fontSize: 12),
      ),

      // ── Snack Bar ─────────────────────────────────────────────────────────
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        contentTextStyle: const TextStyle(fontFamily: fontFamily),
      ),

      // ── Divider ───────────────────────────────────────────────────────────
      dividerTheme: DividerThemeData(
        color: scheme.outlineVariant,
        thickness: 1,
        space: 1,
      ),

      // ── Typography ────────────────────────────────────────────────────────
      textTheme: const TextTheme(
        displayLarge: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w900),
        displayMedium: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w800),
        displaySmall: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700),
        headlineLarge: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700),
        headlineMedium: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700),
        headlineSmall: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600),
        titleLarge: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w700),
        titleMedium: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600),
        titleSmall: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w400),
        bodyMedium: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w400),
        bodySmall: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w400),
        labelLarge: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w600),
        labelMedium: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w500),
        labelSmall: TextStyle(fontFamily: fontFamily, fontWeight: FontWeight.w500),
      ),
    );
  }
}

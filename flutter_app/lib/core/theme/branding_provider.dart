import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../utils/json_utils.dart';

/// Branding model matching the backend /api/settings/branding response.
/// Same shape as the web BrandingProvider.
class BrandingData {
  final String systemName;
  final String sloganAr;
  final String sloganEn;
  final String messageFooter;
  final Color primaryColor;
  final Color secondaryColor;
  final String logoHeader;

  const BrandingData({
    required this.systemName,
    required this.sloganAr,
    required this.sloganEn,
    required this.messageFooter,
    required this.primaryColor,
    required this.secondaryColor,
    required this.logoHeader,
  });

  /// Defaults matching AGENTS.md branding section
  static const BrandingData defaults = BrandingData(
    systemName: 'وحدة التدريب و التطوير',
    sloganAr: 'نحو تعليم أفضل',
    sloganEn: 'Towards Better Learning',
    messageFooter:
        'هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
    primaryColor: Color(0xFF2563EB),
    secondaryColor: Color(0xFF7C3AED),
    logoHeader: '',
  );

  factory BrandingData.fromJson(Map<String, dynamic> json) {
    return BrandingData(
      systemName: toStrOrNull(json['systemName']) ?? defaults.systemName,
      sloganAr: toStrOrNull(json['sloganAr']) ?? defaults.sloganAr,
      sloganEn: toStrOrNull(json['sloganEn']) ?? defaults.sloganEn,
      messageFooter: toStrOrNull(json['messageFooter']) ?? defaults.messageFooter,
      primaryColor: _parseHex(toStrOrNull(json['primaryColor'])) ?? defaults.primaryColor,
      secondaryColor:
          _parseHex(toStrOrNull(json['secondaryColor'])) ?? defaults.secondaryColor,
      logoHeader: toStr(json['logoHeader']),
    );
  }

  static Color? _parseHex(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    final clean = hex.replaceAll('#', '');
    final value = int.tryParse(clean, radix: 16);
    if (value == null) return null;
    return Color(0xFF000000 | value);
  }
}

/// Provides branding data fetched from /api/settings/branding.
/// Used by main.dart to seed the Material 3 ColorScheme dynamically.
class BrandingProvider extends ChangeNotifier {
  BrandingData _branding = BrandingData.defaults;
  bool _loaded = false;

  BrandingData get branding => _branding;
  bool get loaded => _loaded;

  Future<void> load() async {
    try {
      final res = await ApiClient().get(ApiConstants.branding);
      final data = toJsonMap(res.data);
      if (res.statusCode == 200 && data != null) {
        _branding = BrandingData.fromJson(data);
      }
    } catch (_) {
      // Fallback to defaults silently
    } finally {
      _loaded = true;
      notifyListeners();
    }
  }
}

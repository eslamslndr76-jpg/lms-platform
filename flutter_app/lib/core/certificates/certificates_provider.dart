import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/certificate_model.dart';
import '../utils/json_utils.dart';

class CertificatesProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<CertificateModel> _certificates = [];
  bool _isLoading = false;
  String? _error;

  List<CertificateModel> get certificates => _certificates;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchMyCertificates({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      final res = await _api.get(ApiConstants.myCertificates);
      if (res.statusCode == 200 && res.data is List) {
        final list = res.data as List;
        final parsed = <CertificateModel>[];
        for (final item in list) {
          final map = toJsonMap(item);
          if (map == null) continue;
          try {
            parsed.add(CertificateModel.fromJson(map));
          } catch (_) {
            // Unreadable rows are skipped; if none can be read the error state
            // below is shown instead of a misleading empty screen.
          }
        }
        if (list.isNotEmpty && parsed.isEmpty) {
          _error = 'تعذر قراءة الشهادات الواردة، أعد المحاولة';
        } else {
          _certificates = parsed;
          _error = null;
        }
      } else {
        _error = 'تعذر تحميل الشهادات (${res.statusCode})';
      }
    } catch (e) {
      debugPrint('[CERT] fetch error: $e');
      _error = 'تعذر تحميل الشهادات';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

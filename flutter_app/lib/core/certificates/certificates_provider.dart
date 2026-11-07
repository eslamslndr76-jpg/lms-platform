import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/certificate_model.dart';

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
        _certificates = list
            .map((item) => CertificateModel.fromJson(item as Map<String, dynamic>))
            .toList();
        _error = null;
      }
    } catch (_) {
      _error = 'تعذر تحميل الشهادات';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

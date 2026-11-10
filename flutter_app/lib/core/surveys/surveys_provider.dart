import 'package:flutter/foundation.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/survey_model.dart';

/// Handles the post-course survey: list of completed groups, one survey
/// definition + saved draft, auto-saving drafts and final submission.
class SurveysProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<SurveySummary> _surveys = [];
  bool _isLoading = false;
  String? _error;

  List<SurveySummary> get surveys => _surveys;
  bool get isLoading => _isLoading;
  String? get error => _error;

  /// Completed groups the student belongs to, with the survey state.
  Future<void> fetchMySurveys({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }
    try {
      final res = await _api.get(ApiConstants.mySurveys);
      if (res.statusCode == 200 && res.data is List) {
        _surveys = (res.data as List)
            .whereType<Map<String, dynamic>>()
            .map(SurveySummary.fromJson)
            .toList();
        _error = null;
      } else if (!silent) {
        _error = 'تعذر تحميل الاستبيانات (${res.statusCode})';
      }
    } catch (e) {
      debugPrint('[Surveys] list error: $e');
      if (!silent) _error = 'تعذر الاتصال بالخادم';
    } finally {
      if (!silent) {
        _isLoading = false;
        notifyListeners();
      }
    }
  }

  /// Full survey definition + saved draft for one group.
  Future<Survey> fetchSurvey(int groupId) async {
    final res = await _api.get('${ApiConstants.mySurveys}/$groupId');
    if (res.statusCode != 200 || res.data is! Map<String, dynamic>) {
      throw _apiError(res, 'تعذر تحميل الاستبيان');
    }
    return Survey.fromJson(res.data as Map<String, dynamic>);
  }

  /// Auto-save (never overwrites a submitted response).
  Future<void> saveDraft({
    required int groupId,
    required Map<String, dynamic> answers,
    bool isAnonymous = false,
    int currentStep = 0,
  }) async {
    final res = await _api.put(
      '${ApiConstants.mySurveys}/$groupId/draft',
      data: {
        'answers': answers,
        'is_anonymous': isAnonymous,
        'current_step': currentStep,
      },
    );
    if (res.statusCode != 200) {
      throw _apiError(res, 'تعذر حفظ المسودة');
    }
  }

  /// Final submission — one response per student, locks afterwards.
  Future<void> submit({
    required int groupId,
    required Map<String, dynamic> answers,
    bool isAnonymous = false,
  }) async {
    final res = await _api.post(
      '${ApiConstants.mySurveys}/$groupId/submit',
      data: {'answers': answers, 'is_anonymous': isAnonymous},
    );
    if (res.statusCode != 200) {
      throw _apiError(res, 'تعذر إرسال الاستبيان');
    }
    await fetchMySurveys(silent: true);
  }

  /// Extracts the backend's Arabic error message when present.
  String _apiError(dynamic res, String fallback) {
    try {
      final data = res.data;
      if (data is Map && data['error'] != null) return data['error'].toString();
    } catch (_) {}
    return fallback;
  }
}

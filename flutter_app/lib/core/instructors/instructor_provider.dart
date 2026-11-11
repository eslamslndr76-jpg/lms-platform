import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import '../../core/api/api_client.dart';
import '../../core/api/api_constants.dart';
import '../models/instructor_model.dart';
import '../utils/json_utils.dart';

/// مزود منطقة المحاضر (المرحلة 12).
/// نقاط النهاية: /api/instructor/groups, /api/instructor/groups/:id/evaluation{,/draft,/submit},
/// /api/instructor/proposals{,/:id,/:id/submit,/:id/word}.
class InstructorProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  // Groups
  List<InstructorGroup> _groups = [];
  bool _groupsLoading = false;
  String? _groupsError;

  // Evaluation (per group)
  InstructorEvaluation? _evaluation;
  bool _evalLoading = false;
  String? _evalError;

  // Proposals
  List<InstructorProposal> _proposals = [];
  bool _proposalsLoading = false;
  String? _proposalsError;

  // Getters
  List<InstructorGroup> get groups => _groups;
  bool get groupsLoading => _groupsLoading;
  String? get groupsError => _groupsError;

  InstructorEvaluation? get evaluation => _evaluation;
  bool get evalLoading => _evalLoading;
  String? get evalError => _evalError;

  List<InstructorProposal> get proposals => _proposals;
  bool get proposalsLoading => _proposalsLoading;
  String? get proposalsError => _proposalsError;

  /// Reads the backend's Arabic error message without assuming its JSON type.
  String _errorMessage(dynamic data, String fallback) {
    final map = toJsonMap(data);
    return toStrOrNull(map?['error']) ?? fallback;
  }

  // ── Groups ────────────────────────────────────────────────────────────────
  Future<void> fetchGroups({bool silent = false}) async {
    if (!silent) {
      _groupsLoading = true;
      _groupsError = null;
      notifyListeners();
    }
    try {
      final res = await _api.get(ApiConstants.instructorGroups);
      if (res.statusCode == 200 && res.data is List) {
        _groups = toJsonList(res.data).map(InstructorGroup.fromJson).toList();
        _groupsError = null;
      } else {
        _groupsError = 'فشل تحميل المجموعات';
      }
    } catch (e) {
      _groupsError = 'تعذر الاتصال بالخادم';
    } finally {
      if (!silent) {
        _groupsLoading = false;
        notifyListeners();
      }
    }
  }

  // ── Evaluation ────────────────────────────────────────────────────────────
  /// تعريف النموذج + المسودة المحفوظة لمجموعة معينة.
  Future<InstructorEvaluation?> fetchEvaluation(int groupId) async {
    _evalLoading = true;
    _evalError = null;
    notifyListeners();
    try {
      final res = await _api.get(
        ApiConstants.instructorGroupEvaluation.replaceAll(':id', groupId.toString()),
      );
      final data = toJsonMap(res.data);
      if (res.statusCode == 200 && data != null) {
        _evaluation = InstructorEvaluation.fromJson(data);
        _evalError = null;
        return _evaluation;
      }
      _evalError = 'فشل تحميل نموذج التقييم';
    } on DioException catch (e) {
      _evalError = _errorMessage(e.response?.data, 'تعذر الاتصال بالخادم');
    } catch (e) {
      _evalError = 'تعذر الاتصال بالخادم';
    } finally {
      _evalLoading = false;
      notifyListeners();
    }
    return null;
  }

  /// حفظ مسودة التقييم (لا يقفل التعديل).
  Future<bool> saveEvaluationDraft(int groupId, Map<int, List<int?>> scoresByStudent) async {
    try {
      final res = await _api.put(
        ApiConstants.instructorGroupEvaluationDraft.replaceAll(':id', groupId.toString()),
        data: {'scores': scoresByStudent},
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchEvaluation(groupId);
        return true;
      }
      if (res.data is Map) {
        _evalError = _errorMessage(res.data, 'فشل حفظ المسودة');
      }
    } catch (e) {
      _evalError = 'تعذر حفظ المسودة';
    }
    return false;
  }

  /// إرسال التقييم النهائي (قفل بعد الإرسال).
  Future<bool> submitEvaluation(int groupId, Map<int, List<int?>> scoresByStudent) async {
    try {
      final res = await _api.post(
        ApiConstants.instructorGroupEvaluationSubmit.replaceAll(':id', groupId.toString()),
        data: {'scores': scoresByStudent},
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchEvaluation(groupId);
        return true;
      }
      if (res.data is Map) {
        _evalError = _errorMessage(res.data, 'فشل الإرسال');
      }
    } catch (e) {
      _evalError = 'تعذر الإرسال';
    }
    return false;
  }

  // ── Proposals ─────────────────────────────────────────────────────────────
  Future<void> fetchProposals({bool silent = false}) async {
    if (!silent) {
      _proposalsLoading = true;
      _proposalsError = null;
      notifyListeners();
    }
    try {
      final res = await _api.get(ApiConstants.instructorProposals);
      if (res.statusCode == 200 && res.data is List) {
        _proposals = (res.data as List)
            .whereType<Map<String, dynamic>>()
            .map(InstructorProposal.fromJson)
            .toList();
        _proposalsError = null;
      } else {
        _proposalsError = 'فشل تحميل المقترحات';
      }
    } catch (e) {
      _proposalsError = 'تعذر الاتصال بالخادم';
    } finally {
      if (!silent) {
        _proposalsLoading = false;
        notifyListeners();
      }
    }
  }

  /// إنشاء مقترح مسودة جديدة.
  Future<InstructorProposal?> createProposal({
    required String courseTitle,
    required List<String> objectives,
    required List<Map<String, String>> dailyContent,
    String? materialsUrl,
  }) async {
    try {
      final res = await _api.post(
        ApiConstants.instructorProposals,
        data: {
          'course_title': courseTitle.trim(),
          'objectives': objectives.map((t) => {'text': t}).toList(),
          'daily_content': dailyContent.map((d) => {
                'day': d['day'] ?? '',
                'topic': d['topic'] ?? '',
                'instructor': d['instructor'] ?? '',
              }).toList(),
          if (materialsUrl != null && materialsUrl.isNotEmpty)
            'materials_url': materialsUrl,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final created = toJsonMap(res.data);
        if (created != null) {
          final p = InstructorProposal.fromJson(created);
          _proposals.insert(0, p);
          notifyListeners();
          return p;
        }
        await fetchProposals(silent: true);
        return _proposals.firstOrNull;
      }
      if (res.data is Map) {
        _proposalsError = _errorMessage(res.data, 'فشل إنشاء المقترح');
      }
    } catch (e) {
      _proposalsError = 'تعذر إنشاء المقترح';
    }
    return null;
  }

  /// جلب تفاصيل مقترح واحد.
  Future<InstructorProposal?> fetchProposal(int proposalId) async {
    try {
      final res = await _api.get(
        ApiConstants.instructorProposalDetail.replaceAll(':id', proposalId.toString()),
      );
      final data = toJsonMap(res.data);
      if (res.statusCode == 200 && data != null) {
        return InstructorProposal.fromJson(data);
      }
    } catch (_) {}
    return null;
  }

  /// تعديل مقترح (في حالة draft أو needs_changes فقط).
  Future<bool> updateProposal({
    required int proposalId,
    required String courseTitle,
    required List<String> objectives,
    required List<Map<String, String>> dailyContent,
    String? materialsUrl,
  }) async {
    try {
      final res = await _api.put(
        ApiConstants.instructorProposalDetail.replaceAll(':id', proposalId.toString()),
        data: {
          'course_title': courseTitle.trim(),
          'objectives': objectives.map((t) => {'text': t}).toList(),
          'daily_content': dailyContent.map((d) => {
                'day': d['day'] ?? '',
                'topic': d['topic'] ?? '',
                'instructor': d['instructor'] ?? '',
              }).toList(),
          if (materialsUrl != null && materialsUrl.isNotEmpty)
            'materials_url': materialsUrl,
        },
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        final updated = toJsonMap(res.data);
        if (updated != null) {
          final p = InstructorProposal.fromJson(updated);
          _proposals = _proposals.map((pr) => pr.id == proposalId ? p : pr).toList();
          notifyListeners();
        }
        return true;
      }
      if (res.data is Map) {
        _proposalsError = _errorMessage(res.data, 'فشل التعديل');
      }
    } catch (e) {
      _proposalsError = 'تعذر التعديل';
    }
    return false;
  }

  /// تقديم المقترح للإدارة (قفل بعد التقديم).
  Future<bool> submitProposal(int proposalId) async {
    try {
      final res = await _api.post(
        ApiConstants.instructorProposalSubmit.replaceAll(':id', proposalId.toString()),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        await fetchProposals(silent: true);
        return true;
      }
      if (res.data is Map) {
        _proposalsError = _errorMessage(res.data, 'فشل التقديم');
      }
    } catch (e) {
      _proposalsError = 'تعذر التقديم';
    }
    return false;
  }

  /// تنزيل ملف Word للمقترح إلى مجلد مؤقت وإرجاع مساره (يفتحه `open_filex`).
  Future<String?> downloadProposalWord(int proposalId) async {
    try {
      final dir = await getTemporaryDirectory();
      final safeName = 'proposal_$proposalId.docx';
      final path = '${dir.path}${Platform.pathSeparator}$safeName';
      final url =
          '${ApiConstants.defaultBaseUrl}${ApiConstants.instructorProposalWord.replaceAll(':id', proposalId.toString())}';
      await _api.dio.download(
        url,
        path,
        options: Options(responseType: ResponseType.bytes, followRedirects: true),
      );
      final file = File(path);
      if (!await file.exists() || await file.length() < 1024) return null;
      return path;
    } catch (_) {}
    return null;
  }
}

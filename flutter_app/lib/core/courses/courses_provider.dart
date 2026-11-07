import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/api_constants.dart';
import '../models/category_model.dart';
import '../models/course_model.dart';
import '../storage/cache_service.dart';

class CoursesProvider extends ChangeNotifier {
  final ApiClient _api = ApiClient();

  List<CourseModel> _courses = [];
  List<CategoryModel> _categories = [];
  bool _isLoading = false;
  String? _error;
  int? _selectedCategoryId;
  String _searchQuery = '';

  CoursesProvider() {
    _loadFromCache();
  }

  Future<void> _loadFromCache() async {
    try {
      final cachedCourses = await CacheService.load(CacheService.keyCourses);
      if (cachedCourses is List && cachedCourses.isNotEmpty) {
        _courses = cachedCourses.map((c) => CourseModel.fromJson(c as Map<String, dynamic>)).toList();
      }

      final cachedCats = await CacheService.load(CacheService.keyCategories);
      if (cachedCats is List && cachedCats.isNotEmpty) {
        _categories = cachedCats.map((cat) => CategoryModel.fromJson(cat as Map<String, dynamic>)).toList();
      }

      if (_courses.isNotEmpty) {
        notifyListeners();
      }
    } catch (_) {}
  }

  List<CourseModel> get courses {
    var filtered = _courses;
    if (_selectedCategoryId != null) {
      filtered = filtered.where((c) => c.categoryId == _selectedCategoryId).toList();
    }
    if (_searchQuery.trim().isNotEmpty) {
      final q = _searchQuery.trim().toLowerCase();
      filtered = filtered.where((c) {
        final ar = c.titleAr.toLowerCase();
        final en = c.titleEn?.toLowerCase() ?? '';
        final ins = c.instructor?.toLowerCase() ?? '';
        return ar.contains(q) || en.contains(q) || ins.contains(q);
      }).toList();
    }
    return filtered;
  }

  List<CourseModel> get allCourses => _courses;
  List<CategoryModel> get categories => _categories;
  bool get isLoading => _isLoading;
  String? get error => _error;
  int? get selectedCategoryId => _selectedCategoryId;
  String get searchQuery => _searchQuery;

  // ── Fetch Courses & Categories ─────────────────────────────────────────────
  Future<void> fetchAll({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _error = null;
      notifyListeners();
    }

    try {
      final responses = await Future.wait([
        _api.get(ApiConstants.courses),
        _api.get(ApiConstants.categories),
      ]);

      if (responses[0].statusCode == 200 && responses[0].data is List) {
        final list = responses[0].data as List;
        _courses = list.map((item) => CourseModel.fromJson(item as Map<String, dynamic>)).toList();
        CacheService.save(CacheService.keyCourses, responses[0].data);
      }

      if (responses[1].statusCode == 200 && responses[1].data is List) {
        final list = responses[1].data as List;
        _categories = list.map((item) => CategoryModel.fromJson(item as Map<String, dynamic>)).toList();
        CacheService.save(CacheService.keyCategories, responses[1].data);
      }

      _error = null;
    } catch (e) {
      if (_courses.isEmpty) {
        _error = 'فشل تحميل بيانات الكورسات، تحقق من الاتصال بالشبكة';
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // ── Set Category Filter ───────────────────────────────────────────────────
  void setCategory(int? categoryId) {
    if (_selectedCategoryId == categoryId) {
      _selectedCategoryId = null; // Toggle off
    } else {
      _selectedCategoryId = categoryId;
    }
    notifyListeners();
  }

  // ── Set Search Query ──────────────────────────────────────────────────────
  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  // ── Fetch Single Course Details ───────────────────────────────────────────
  Future<CourseModel?> fetchCourseDetails(int id) async {
    try {
      final res = await _api.get('${ApiConstants.courses}/$id');
      if (res.statusCode == 200 && res.data is Map<String, dynamic>) {
        return CourseModel.fromJson(res.data as Map<String, dynamic>);
      }
    } catch (_) {}
    return null;
  }
}

class CourseModel {
  final int id;
  final String titleAr;
  final String? titleEn;
  final String? descriptionAr;
  final String? descriptionEn;
  final String? image;
  final double price;
  final String? instructor;
  final int? hours;
  final int? categoryId;
  final String? categoryNameAr;
  final bool featured;
  final int? groupMax;
  final int? groupCurrent;

  const CourseModel({
    required this.id,
    required this.titleAr,
    this.titleEn,
    this.descriptionAr,
    this.descriptionEn,
    this.image,
    required this.price,
    this.instructor,
    this.hours,
    this.categoryId,
    this.categoryNameAr,
    this.featured = false,
    this.groupMax,
    this.groupCurrent,
  });

  static int _parseInt(dynamic val, [int defaultVal = 0]) {
    if (val == null) return defaultVal;
    if (val is num) return val.toInt();
    if (val is String) return int.tryParse(val) ?? defaultVal;
    return defaultVal;
  }

  static int? _parseNullableInt(dynamic val) {
    if (val == null) return null;
    if (val is num) return val.toInt();
    if (val is String) return int.tryParse(val);
    return null;
  }

  static double _parseDouble(dynamic val, [double defaultVal = 0.0]) {
    if (val == null) return defaultVal;
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? defaultVal;
    return defaultVal;
  }

  static bool _parseBool(dynamic val) {
    if (val == null) return false;
    if (val is bool) return val;
    if (val is num) return val.toInt() == 1;
    if (val is String) return val == '1' || val.toLowerCase() == 'true';
    return false;
  }

  factory CourseModel.fromJson(Map<String, dynamic> json) {
    return CourseModel(
      id: _parseInt(json['id']),
      titleAr: json['title_ar']?.toString() ?? '',
      titleEn: json['title_en']?.toString(),
      descriptionAr: json['description_ar']?.toString(),
      descriptionEn: json['description_en']?.toString(),
      image: (json['image'] ?? json['image_url'])?.toString(),
      price: _parseDouble(json['price']),
      instructor: json['instructor']?.toString(),
      hours: _parseNullableInt(json['hours']),
      categoryId: _parseNullableInt(json['category_id']),
      categoryNameAr: json['category_name_ar']?.toString(),
      featured: _parseBool(json['featured']),
      groupMax: _parseNullableInt(json['group_max']),
      groupCurrent: _parseNullableInt(json['group_current']),
    );
  }

  /// Calculates fill percentage of current group (0.0 to 1.0)
  double get fillRate {
    if (groupMax == null || groupMax! <= 0) return 0.0;
    final curr = groupCurrent ?? 0;
    final rate = curr / groupMax!;
    if (rate.isNaN || rate.isInfinite) return 0.0;
    return rate.clamp(0.0, 1.0);
  }

  bool get isFull {
    if (groupMax == null || groupMax! <= 0) return false;
    return (groupCurrent ?? 0) >= groupMax!;
  }
}

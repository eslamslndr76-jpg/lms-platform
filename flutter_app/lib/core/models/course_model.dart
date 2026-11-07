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

  factory CourseModel.fromJson(Map<String, dynamic> json) {
    return CourseModel(
      id: (json['id'] as num).toInt(),
      titleAr: json['title_ar'] as String? ?? '',
      titleEn: json['title_en'] as String?,
      descriptionAr: json['description_ar'] as String?,
      descriptionEn: json['description_en'] as String?,
      image: (json['image'] ?? json['image_url']) as String?,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      instructor: json['instructor'] as String?,
      hours: (json['hours'] as num?)?.toInt(),
      categoryId: (json['category_id'] as num?)?.toInt(),
      categoryNameAr: json['category_name_ar'] as String?,
      featured: (json['featured'] as num?)?.toInt() == 1,
      groupMax: (json['group_max'] as num?)?.toInt(),
      groupCurrent: (json['group_current'] as num?)?.toInt(),
    );
  }

  /// Calculates fill percentage of current group (0.0 to 1.0)
  double get fillRate {
    if (groupMax == null || groupMax == 0) return 0.0;
    final curr = groupCurrent ?? 0;
    return (curr / groupMax!).clamp(0.0, 1.0);
  }

  bool get isFull {
    if (groupMax == null || groupMax == 0) return false;
    return (groupCurrent ?? 0) >= groupMax!;
  }
}

import '../utils/json_utils.dart';

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

  /// Google Drive link to the scientific material (staff/enrolled only).
  final String? materialsUrl;

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
    this.materialsUrl,
  });

  factory CourseModel.fromJson(Map<String, dynamic> json) {
    return CourseModel(
      id: toInt(json['id']),
      titleAr: toStr(json['title_ar']),
      titleEn: toStrOrNull(json['title_en']),
      descriptionAr: toStrOrNull(json['description_ar']),
      descriptionEn: toStrOrNull(json['description_en']),
      image: toStrOrNull(json['image'] ?? json['image_url']),
      price: toDouble(json['price']),
      instructor: toStrOrNull(json['instructor']),
      hours: toIntOrNull(json['hours']),
      categoryId: toIntOrNull(json['category_id']),
      categoryNameAr: toStrOrNull(json['category_name_ar']),
      featured: toBool(json['featured']),
      groupMax: toIntOrNull(json['group_max']),
      groupCurrent: toIntOrNull(json['group_current']),
      materialsUrl: toStrOrNull(json['materials_url']),
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

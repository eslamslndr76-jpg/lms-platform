class CartItemModel {
  final int id;
  final int courseId;
  final String titleAr;
  final String? titleEn;
  final double price;
  final String? image;
  final String? instructor;
  final String? categoryNameAr;
  final String? createdAt;

  const CartItemModel({
    required this.id,
    required this.courseId,
    required this.titleAr,
    this.titleEn,
    required this.price,
    this.image,
    this.instructor,
    this.categoryNameAr,
    this.createdAt,
  });

  static int _parseInt(dynamic val, [int defaultVal = 0]) {
    if (val == null) return defaultVal;
    if (val is num) return val.toInt();
    if (val is String) return int.tryParse(val) ?? defaultVal;
    return defaultVal;
  }

  static double _parseDouble(dynamic val, [double defaultVal = 0.0]) {
    if (val == null) return defaultVal;
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? defaultVal;
    return defaultVal;
  }

  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    return CartItemModel(
      id: _parseInt(json['id']),
      courseId: _parseInt(json['course_id']),
      titleAr: json['title_ar']?.toString() ?? '',
      titleEn: json['title_en']?.toString(),
      price: _parseDouble(json['price']),
      image: (json['image_url'] ?? json['image'])?.toString(),
      instructor: json['instructor']?.toString(),
      categoryNameAr: json['category_name_ar']?.toString(),
      createdAt: json['created_at']?.toString(),
    );
  }
}

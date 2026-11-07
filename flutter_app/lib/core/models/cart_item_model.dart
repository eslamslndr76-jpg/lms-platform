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

  factory CartItemModel.fromJson(Map<String, dynamic> json) {
    return CartItemModel(
      id: (json['id'] as num).toInt(),
      courseId: (json['course_id'] as num).toInt(),
      titleAr: json['title_ar'] as String? ?? '',
      titleEn: json['title_en'] as String?,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      image: (json['image_url'] ?? json['image']) as String?,
      instructor: json['instructor'] as String?,
      categoryNameAr: json['category_name_ar'] as String?,
      createdAt: json['created_at'] as String?,
    );
  }
}

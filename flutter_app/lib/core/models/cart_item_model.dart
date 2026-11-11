import '../utils/json_utils.dart';

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
      id: toInt(json['id']),
      courseId: toInt(json['course_id']),
      titleAr: toStr(json['title_ar']),
      titleEn: toStrOrNull(json['title_en']),
      price: toDouble(json['price']),
      image: toStrOrNull(json['image_url'] ?? json['image']),
      instructor: toStrOrNull(json['instructor']),
      categoryNameAr: toStrOrNull(json['category_name_ar']),
      createdAt: toStrOrNull(json['created_at']),
    );
  }
}

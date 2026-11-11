import '../utils/json_utils.dart';

class CategoryModel {
  final int id;
  final String nameAr;
  final String nameEn;
  final String? description;

  const CategoryModel({
    required this.id,
    required this.nameAr,
    required this.nameEn,
    this.description,
  });

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: toInt(json['id']),
      nameAr: toStr(json['name_ar']),
      nameEn: toStr(json['name_en']),
      description: toStrOrNull(json['description']),
    );
  }
}

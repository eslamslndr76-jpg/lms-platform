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
      id: (json['id'] as num).toInt(),
      nameAr: json['name_ar'] as String? ?? '',
      nameEn: json['name_en'] as String? ?? '',
      description: json['description'] as String?,
    );
  }
}

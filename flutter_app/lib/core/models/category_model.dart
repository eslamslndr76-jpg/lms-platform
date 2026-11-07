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

  static int _parseInt(dynamic val, [int defaultVal = 0]) {
    if (val == null) return defaultVal;
    if (val is num) return val.toInt();
    if (val is String) return int.tryParse(val) ?? defaultVal;
    return defaultVal;
  }

  factory CategoryModel.fromJson(Map<String, dynamic> json) {
    return CategoryModel(
      id: _parseInt(json['id']),
      nameAr: json['name_ar']?.toString() ?? '',
      nameEn: json['name_en']?.toString() ?? '',
      description: json['description']?.toString(),
    );
  }
}

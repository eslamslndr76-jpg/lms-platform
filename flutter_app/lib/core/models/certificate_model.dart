class CertificateModel {
  final int id;
  final String serialId;
  final String titleAr;
  final String? titleEn;
  final String issuedAt;
  final String status; // 'active' | 'revoked'

  const CertificateModel({
    required this.id,
    required this.serialId,
    required this.titleAr,
    this.titleEn,
    required this.issuedAt,
    this.status = 'active',
  });

  factory CertificateModel.fromJson(Map<String, dynamic> json) {
    return CertificateModel(
      id: (json['id'] as num).toInt(),
      serialId: json['serial_id'] as String? ?? '',
      titleAr: json['title_ar'] as String? ?? 'شهادة إتمام دورة',
      titleEn: json['title_en'] as String?,
      issuedAt: json['issued_at'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
    );
  }

  bool get isActive => status == 'active';
}

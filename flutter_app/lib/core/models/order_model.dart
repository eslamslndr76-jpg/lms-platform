class OrderModel {
  final int id;
  final int courseId;
  final double amount;
  final String status; // 'pending' | 'review' | 'paid' | 'rejected'
  final String? receiptUrl;
  final String? paymentMethod;
  final String? titleAr;
  final String? titleEn;
  final String? instructor;
  final String? createdAt;

  const OrderModel({
    required this.id,
    required this.courseId,
    required this.amount,
    required this.status,
    this.receiptUrl,
    this.paymentMethod,
    this.titleAr,
    this.titleEn,
    this.instructor,
    this.createdAt,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    return OrderModel(
      id: (json['id'] as num).toInt(),
      courseId: (json['course_id'] as num).toInt(),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'pending',
      receiptUrl: json['receipt_url'] as String?,
      paymentMethod: json['payment_method'] as String?,
      titleAr: json['title_ar'] as String?,
      titleEn: json['title_en'] as String?,
      instructor: json['instructor'] as String?,
      createdAt: json['created_at'] as String?,
    );
  }

  String get statusTextAr {
    switch (status) {
      case 'paid':
        return 'مؤكد ومسجل';
      case 'review':
        return 'قيد المراجعة';
      case 'rejected':
        return 'مرفوض';
      case 'pending':
      default:
        return 'في انتظار السداد';
    }
  }

  bool get isPaid => status == 'paid';
}

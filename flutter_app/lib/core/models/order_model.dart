import '../utils/json_utils.dart';

class OrderItemModel {
  final int id;
  final int courseId;
  final String? titleAr;
  final String? titleEn;
  final double price;
  final String? instructor;

  const OrderItemModel({
    required this.id,
    required this.courseId,
    this.titleAr,
    this.titleEn,
    this.price = 0,
    this.instructor,
  });

  factory OrderItemModel.fromJson(Map<String, dynamic> json) {
    return OrderItemModel(
      id: toInt(json['id']),
      courseId: toInt(json['course_id']),
      titleAr: toStrOrNull(json['title_ar']),
      titleEn: toStrOrNull(json['title_en']),
      price: toDouble(json['price']),
      instructor: toStrOrNull(json['instructor']),
    );
  }

  String get displayTitle =>
      (titleAr != null && titleAr!.isNotEmpty) ? titleAr! : (titleEn ?? '');
}

class OrderModel {
  final int id;
  final int courseId;
  final double amount;
  final String status; // 'pending' | 'review' | 'paid' | 'rejected' | 'cancelled'
  final String? receiptUrl;
  final String? paymentMethod;
  final String? titleAr;
  final String? titleEn;
  final String? instructor;
  final String? createdAt;
  final String? cancelReason; // 'student' | 'admin' | 'expired' | null
  final List<OrderItemModel> items;

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
    this.cancelReason,
    this.items = const [],
  });

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    return OrderModel(
      id: toInt(json['id']),
      courseId: toInt(json['course_id']),
      amount: toDouble(json['amount']),
      status: toStrOrNull(json['status']) ?? 'pending',
      receiptUrl: toStrOrNull(json['receipt_url']),
      paymentMethod: toStrOrNull(json['payment_method']),
      titleAr: toStrOrNull(json['title_ar']),
      titleEn: toStrOrNull(json['title_en']),
      instructor: toStrOrNull(json['instructor']),
      createdAt: toStrOrNull(json['created_at']),
      cancelReason: toStrOrNull(json['cancel_reason']),
      items: toJsonList(json['items']).map(OrderItemModel.fromJson).toList(),
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
      case 'cancelled':
        return 'ملغي';
      case 'pending':
      default:
        return 'في انتظار السداد';
    }
  }

  /// Reason shown for cancelled orders.
  String? get cancelReasonTextAr {
    if (status != 'cancelled') return null;
    switch (cancelReason) {
      case 'student':
        return 'أُلغي بواسطتك';
      case 'admin':
        return 'أُلغي بواسطة الإدارة';
      case 'expired':
        return 'انتهت مدة الحجز تلقائياً';
      default:
        return 'ملغي';
    }
  }

  bool get isPaid => status == 'paid';

  /// Open (not paid, not cancelled) → the student can still pay or cancel.
  bool get isOpen => status == 'pending' || status == 'review';
}

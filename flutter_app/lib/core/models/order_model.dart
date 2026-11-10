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
    final rawId = json['id'];
    final rawCourse = json['course_id'];
    return OrderItemModel(
      id: rawId is num ? rawId.toInt() : int.tryParse('$rawId') ?? 0,
      courseId: rawCourse is num ? rawCourse.toInt() : int.tryParse('$rawCourse') ?? 0,
      titleAr: json['title_ar'] as String?,
      titleEn: json['title_en'] as String?,
      price: (json['price'] as num?)?.toDouble() ?? 0,
      instructor: json['instructor'] as String?,
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
    final rawId = json['id'];
    final id = rawId is num ? rawId.toInt() : int.tryParse(rawId.toString()) ?? 0;

    final rawCourseId = json['course_id'];
    final courseId =
        rawCourseId is num ? rawCourseId.toInt() : int.tryParse(rawCourseId.toString()) ?? 0;

    final rawItems = json['items'];
    final items = rawItems is List
        ? rawItems
            .whereType<Map<String, dynamic>>()
            .map(OrderItemModel.fromJson)
            .toList()
        : <OrderItemModel>[];

    return OrderModel(
      id: id,
      courseId: courseId,
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'pending',
      receiptUrl: json['receipt_url'] as String?,
      paymentMethod: json['payment_method'] as String?,
      titleAr: json['title_ar'] as String?,
      titleEn: json['title_en'] as String?,
      instructor: json['instructor'] as String?,
      createdAt: json['created_at'] as String?,
      cancelReason: json['cancel_reason'] as String?,
      items: items,
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

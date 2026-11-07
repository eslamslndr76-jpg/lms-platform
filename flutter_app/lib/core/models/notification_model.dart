class NotificationModel {
  final int id;
  final int userId;
  final String title;
  final String? message;
  final String type; // 'info' | 'success' | 'warning'
  final String? link;
  final bool isRead;
  final String? createdAt;

  const NotificationModel({
    required this.id,
    required this.userId,
    required this.title,
    this.message,
    this.type = 'info',
    this.link,
    this.isRead = false,
    this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: (json['id'] as num).toInt(),
      userId: (json['user_id'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      message: json['message'] as String?,
      type: json['type'] as String? ?? 'info',
      link: json['link'] as String?,
      isRead: (json['is_read'] as num?)?.toInt() == 1,
      createdAt: json['created_at'] as String?,
    );
  }

  NotificationModel copyWith({bool? isRead}) {
    return NotificationModel(
      id: id,
      userId: userId,
      title: title,
      message: message,
      type: type,
      link: link,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
    );
  }
}

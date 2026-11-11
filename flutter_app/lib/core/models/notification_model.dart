import '../utils/json_utils.dart';

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
      id: toInt(json['id']),
      userId: toInt(json['user_id']),
      title: toStr(json['title']),
      message: toStrOrNull(json['message']),
      type: toStrOrNull(json['type']) ?? 'info',
      link: toStrOrNull(json['link']),
      // The API may return 1/0 or "1"/"0" — never compare to a raw num.
      isRead: toBool(json['is_read']),
      createdAt: toStrOrNull(json['created_at']),
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

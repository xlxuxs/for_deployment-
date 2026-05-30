import '../../domain/entities/notification.dart';

class NotificationModel extends NotificationEntity {
  const NotificationModel({
    required super.id,
    required super.userId,
    required super.userRole,
    required super.type,
    required super.title,
    required super.message,
    super.data,
    required super.read,
    required super.severity,
    required super.source,
    required super.createdAt,
  });

  /// Create from JSON (backend API response format)
  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    return NotificationModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      userId: json['userId']?.toString() ?? '',
      userRole: json['userRole']?.toString() ?? '',
      type: NotificationType.fromString(json['type']?.toString() ?? ''),
      title: json['title']?.toString() ?? 'Notification',
      message: json['message']?.toString() ?? '',
      data: data is Map<String, dynamic> ? data : null,
      read: json['read'] == true,
      severity: NotificationSeverity.fromString(
        json['severity']?.toString() ?? 'info',
      ),
      source: NotificationSource.fromString(
        json['source']?.toString() ?? 'system',
      ),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  /// Convert to JSON
  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'userId': userId,
      'userRole': userRole,
      'type': type.value,
      'title': title,
      'message': message,
      'data': data,
      'read': read,
      'severity': severity.value,
      'source': source.value,
      'createdAt': createdAt.toIso8601String(),
    };
  }

  /// Create a copy with updated fields
  NotificationModel copyWith({
    String? id,
    String? userId,
    String? userRole,
    NotificationType? type,
    String? title,
    String? message,
    Map<String, dynamic>? data,
    bool? read,
    NotificationSeverity? severity,
    NotificationSource? source,
    DateTime? createdAt,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      userRole: userRole ?? this.userRole,
      type: type ?? this.type,
      title: title ?? this.title,
      message: message ?? this.message,
      data: data ?? this.data,
      read: read ?? this.read,
      severity: severity ?? this.severity,
      source: source ?? this.source,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

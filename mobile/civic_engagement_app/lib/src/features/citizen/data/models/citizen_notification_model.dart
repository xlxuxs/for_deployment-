import '../../domain/entities/citizen_notification.dart';

class CitizenNotificationModel extends CitizenNotification {
  const CitizenNotificationModel({
    required super.id,
    required super.type,
    required super.title,
    required super.message,
    required super.read,
    required super.data,
    super.createdAt,
    super.userId,
    super.userRole,
    super.severity,
    super.source,
  });

  /// Parse notification from backend API response (Section 12.4)
  factory CitizenNotificationModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    return CitizenNotificationModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      type: json['type']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Notification',
      message: json['message']?.toString() ?? '',
      read: json['read'] == true,
      data: data is Map<String, dynamic> ? data : const {},
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      // NEW fields from Section 12.4
      userId: json['userId']?.toString(),
      userRole: json['userRole']?.toString(),
      severity: json['severity'] != null
          ? NotificationSeverity.fromString(json['severity'].toString())
          : NotificationSeverity.info,
      source: json['source'] != null
          ? NotificationSource.fromString(json['source'].toString())
          : NotificationSource.system,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'type': type,
      'title': title,
      'message': message,
      'read': read,
      'data': data,
      'createdAt': createdAt?.toIso8601String(),
      'userId': userId,
      'userRole': userRole,
      'severity': severity.name,
      'source': source.name,
    };
  }
}

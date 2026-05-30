import 'package:equatable/equatable.dart';

/// Notification severity levels (Section 12.4)
enum NotificationSeverity {
  info,
  warning,
  critical;

  static NotificationSeverity fromString(String value) {
    switch (value.toLowerCase()) {
      case 'warning':
        return NotificationSeverity.warning;
      case 'critical':
        return NotificationSeverity.critical;
      default:
        return NotificationSeverity.info;
    }
  }
}

/// Notification source (Section 12.4)
enum NotificationSource {
  system,
  alert;

  static NotificationSource fromString(String value) {
    return value.toLowerCase() == 'alert'
        ? NotificationSource.alert
        : NotificationSource.system;
  }
}

/// Updated CitizenNotification entity with new fields from Section 12.4
class CitizenNotification extends Equatable {
  const CitizenNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.message,
    required this.read,
    required this.data,
    this.createdAt,
    this.userId,
    this.userRole,
    this.severity = NotificationSeverity.info,
    this.source = NotificationSource.system,
  });

  final String id;
  final String type;
  final String title;
  final String message;
  final bool read;
  final Map<String, dynamic> data;
  final DateTime? createdAt;
  
  // NEW fields from Section 12.4
  final String? userId;
  final String? userRole;
  final NotificationSeverity severity;
  final NotificationSource source;

  String? get policyId => data['policyId']?.toString();
  String? get commentId => data['commentId']?.toString();
  
  // NEW: Check if this is a smart alert
  bool get isSmartAlert => source == NotificationSource.alert;
  
  // NEW: Check severity levels
  bool get isCritical => severity == NotificationSeverity.critical;
  bool get isWarning => severity == NotificationSeverity.warning;
  bool get isInfo => severity == NotificationSeverity.info;

  @override
  List<Object?> get props => [
        id,
        type,
        title,
        message,
        read,
        data,
        createdAt,
        userId,
        userRole,
        severity,
        source,
      ];
}

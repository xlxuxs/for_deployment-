import 'package:equatable/equatable.dart';

/// Notification types as per backend API Section 12.3
enum NotificationType {
  policyActivated('POLICY_ACTIVATED'),
  policyAutoActivated('POLICY_AUTO_ACTIVATED'),
  policyClosed('POLICY_CLOSED'),
  policyAutoClosed('POLICY_AUTO_CLOSED'),
  policyExtended('POLICY_EXTENDED'),
  policyLifecycle('POLICY_LIFECYCLE'),
  associateAssigned('ASSOCIATE_ASSIGNED'),
  associatePermissionsUpdated('ASSOCIATE_PERMISSIONS_UPDATED'),
  associateRevoked('ASSOCIATE_REVOKED'),
  messageReceived('MESSAGE_RECEIVED'),
  commentReply('COMMENT_REPLY'),
  commentFlagged('COMMENT_FLAGGED'),
  commentAppeal('COMMENT_APPEAL'),
  appealResolved('APPEAL_RESOLVED'),
  voteSurge('VOTE_SURGE'),
  ratingDrop('RATING_DROP'),
  emergingTopic('EMERGING_TOPIC'),
  plannerApproved('PLANNER_APPROVED'),
  plannerRequestApproved('PLANNER_REQUEST_APPROVED'),
  accountDeletionConfirmed('ACCOUNT_DELETION_CONFIRMED'),
  unknown('UNKNOWN');

  final String value;
  const NotificationType(this.value);

  static NotificationType fromString(String value) {
    return NotificationType.values.firstWhere(
      (type) => type.value == value,
      orElse: () => NotificationType.unknown,
    );
  }
}

/// Notification severity levels
enum NotificationSeverity {
  info('info'),
  warning('warning'),
  critical('critical');

  final String value;
  const NotificationSeverity(this.value);

  static NotificationSeverity fromString(String value) {
    return NotificationSeverity.values.firstWhere(
      (severity) => severity.value == value,
      orElse: () => NotificationSeverity.info,
    );
  }
}

/// Notification source
enum NotificationSource {
  system('system'),
  alert('alert');

  final String value;
  const NotificationSource(this.value);

  static NotificationSource fromString(String value) {
    return NotificationSource.values.firstWhere(
      (source) => source.value == value,
      orElse: () => NotificationSource.system,
    );
  }
}

/// Notification entity as per backend API Section 12.4
class NotificationEntity extends Equatable {
  final String id;
  final String userId;
  final String userRole;
  final NotificationType type;
  final String title;
  final String message;
  final Map<String, dynamic>? data;
  final bool read;
  final NotificationSeverity severity;
  final NotificationSource source;
  final DateTime createdAt;

  const NotificationEntity({
    required this.id,
    required this.userId,
    required this.userRole,
    required this.type,
    required this.title,
    required this.message,
    this.data,
    required this.read,
    required this.severity,
    required this.source,
    required this.createdAt,
  });

  /// Check if this is a smart alert
  bool get isSmartAlert => source == NotificationSource.alert;

  /// Check if this is a critical notification
  bool get isCritical => severity == NotificationSeverity.critical;

  /// Check if this is a warning
  bool get isWarning => severity == NotificationSeverity.warning;

  /// Get policy ID from data if available
  String? get policyId => data?['policyId'] as String?;

  /// Get comment ID from data if available
  String? get commentId => data?['commentId'] as String?;

  @override
  List<Object?> get props => [
        id,
        userId,
        userRole,
        type,
        title,
        message,
        data,
        read,
        severity,
        source,
        createdAt,
      ];
}

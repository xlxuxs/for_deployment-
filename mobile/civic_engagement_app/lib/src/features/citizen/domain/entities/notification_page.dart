import 'package:equatable/equatable.dart';

import 'citizen_notification.dart';

class NotificationPage extends Equatable {
  const NotificationPage({
    required this.notifications,
    required this.total,
    required this.page,
  });

  final List<CitizenNotification> notifications;
  final int total;
  final int page;

  @override
  List<Object?> get props => [notifications, total, page];
}

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/state/request_status.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/citizen_notification.dart';
import '../cubit/notifications_cubit.dart';

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocListener<NotificationsCubit, NotificationsState>(
      listenWhen: (previous, current) =>
          previous.actionStatus != current.actionStatus &&
          current.message != null,
      listener: (context, state) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(state.message!)));
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Alerts'),
          actions: [
            IconButton(
              tooltip: 'Mark all read',
              onPressed: () => context.read<NotificationsCubit>().markAllRead(),
              icon: const Icon(Icons.done_all_rounded),
            ),
            IconButton(
              tooltip: 'Refresh',
              onPressed: () =>
                  context.read<NotificationsCubit>().loadNotifications(),
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        body: BlocBuilder<NotificationsCubit, NotificationsState>(
          builder: (context, state) {
            if (state.status == RequestStatus.loading &&
                state.notifications.isEmpty) {
              return const Center(
                  child: CircularProgressIndicator(color: AppTheme.primary));
            }

            if (state.status == RequestStatus.failure &&
                state.notifications.isEmpty) {
              return ErrorView(
                message: state.message ?? 'Failed to load notifications.',
                onRetry: () =>
                    context.read<NotificationsCubit>().loadNotifications(),
              );
            }

            return RefreshIndicator(
              onRefresh: () =>
                  context.read<NotificationsCubit>().loadNotifications(
                        unreadOnly: state.unreadOnly,
                      ),
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(child: _NotificationFilters(state: state)),
                  if (state.notifications.isEmpty)
                    const SliverFillRemaining(
                      child: EmptyState(
                        icon: Icons.notifications_none_rounded,
                        title: 'No alerts',
                        message:
                            'Policy closure and result updates will appear here.',
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                      sliver: SliverList.builder(
                        itemCount: state.notifications.length,
                        itemBuilder: (context, index) {
                          final item = state.notifications[index];
                          return _NotificationCard(
                            item: item,
                            onTap: () {
                              if (!item.read) {
                                context.read<NotificationsCubit>().markRead(
                                      item.id,
                                    );
                              }
                            },
                          );
                        },
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationFilters extends StatelessWidget {
  const _NotificationFilters({required this.state});

  final NotificationsState state;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 2, 16, 8),
      child: Row(
        children: [
          _chip(
            context,
            label: 'All',
            selected: !state.unreadOnly,
            unreadOnly: false,
          ),
          const SizedBox(width: 8),
          _chip(
            context,
            label: 'Unread',
            selected: state.unreadOnly,
            unreadOnly: true,
          ),
        ],
      ),
    );
  }

  Widget _chip(
    BuildContext context, {
    required String label,
    required bool selected,
    required bool unreadOnly,
  }) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      showCheckmark: false,
      onSelected: (_) => context.read<NotificationsCubit>().loadNotifications(
            unreadOnly: unreadOnly,
          ),
      selectedColor: AppTheme.primary.withValues(alpha: 0.14),
      labelStyle: TextStyle(
        color: selected ? AppTheme.primary : AppTheme.mutedText,
        fontWeight: FontWeight.w800,
      ),
      side: BorderSide(
        color: selected ? AppTheme.primary : const Color(0xFFE5EDF3),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item, required this.onTap});

  final CitizenNotification item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: item.read
                  ? const Color(0xFFF1F5F9)
                  : _colorForItem(item).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(
              _iconForType(item.type, item.read),
              color: item.read ? AppTheme.mutedText : _colorForItem(item),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w900,
                            ),
                      ),
                    ),
                    if (!item.read)
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: AppTheme.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  item.message,
                  style: const TextStyle(
                    color: AppTheme.mutedText,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  DateFormatters.compact(item.createdAt),
                  style: const TextStyle(
                    color: AppTheme.mutedText,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

IconData _iconForType(String type, bool read) {
  switch (type) {
    case 'POLICY_ACTIVATED':
    case 'POLICY_AUTO_ACTIVATED':
      return Icons.play_circle_outline_rounded;
    case 'POLICY_CLOSED':
    case 'POLICY_AUTO_CLOSED':
      return Icons.lock_clock_rounded;
    case 'POLICY_EXTENDED':
    case 'POLICY_LIFECYCLE':
      return Icons.event_repeat_rounded;
    case 'ASSOCIATE_ASSIGNED':
    case 'ASSOCIATE_PERMISSIONS_UPDATED':
    case 'ASSOCIATE_REVOKED':
      return Icons.group_add_outlined;
    case 'COMMENT_REPLY':
      return Icons.reply_rounded;
    case 'COMMENT_FLAGGED':
      return Icons.flag_outlined;
    case 'COMMENT_APPEAL':
      return Icons.rate_review_outlined;
    case 'APPEAL_RESOLVED':
      return Icons.gavel_rounded;
    case 'PLANNER_APPROVED':
    case 'PLANNER_REQUEST_APPROVED':
      return Icons.verified_user_outlined;
    case 'VOTE_SURGE':
    case 'RATING_DROP':
    case 'EMERGING_TOPIC':
      return Icons.monitor_heart_outlined;
    default:
      return read
          ? Icons.notifications_none_rounded
          : Icons.notifications_active_rounded;
  }
}

Color _colorForItem(CitizenNotification item) {
  if (item.isCritical) return const Color(0xFFE53E3E);
  if (item.isWarning) return const Color(0xFFB7791F);
  return AppTheme.primary;
}

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/state/request_status.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_formatters.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/vote_history.dart';
import '../../domain/entities/vote_value.dart';
import '../cubit/history_cubit.dart';
import '../cubit/vote_cubit.dart';
import '../widgets/rating_stars.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My votes'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => context.read<HistoryCubit>().loadHistory(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: BlocBuilder<HistoryCubit, HistoryState>(
        builder: (context, state) {
          if (state.status == RequestStatus.loading && state.history.isEmpty) {
            return const Center(child: CircularProgressIndicator(color: AppTheme.primary));
          }

          if (state.status == RequestStatus.failure && state.history.isEmpty) {
            return ErrorView(
              message: state.message ?? 'Failed to load vote history.',
              onRetry: () => context.read<HistoryCubit>().loadHistory(),
            );
          }

          if (state.history.isEmpty) {
            return const EmptyState(
              icon: Icons.history_outlined,
              title: 'No votes yet',
              message: 'Your policy ratings and comments will be listed here.',
            );
          }

          return RefreshIndicator(
            onRefresh: () => context.read<HistoryCubit>().loadHistory(),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              itemCount: state.history.length,
              itemBuilder: (context, index) {
                final item = state.history[index];
                return _HistoryCard(
                  item: item,
                  onComment: item.hasComment
                      ? null
                      : () => _showCommentSheet(context, item),
                );
              },
            ),
          );
        },
      ),
    );
  }

  Future<void> _showCommentSheet(BuildContext context, VoteHistory item) async {
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BlocProvider.value(
        value: context.read<VoteCubit>(),
        child: _CommentSheet(item: item),
      ),
    );

    if (added == true && context.mounted) {
      context.read<HistoryCubit>().loadHistory();
    }
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.item, required this.onComment});

  final VoteHistory item;
  final VoidCallback? onComment;

  String _formatVoteValue() {
    // Get the poll type from the item, default to 'rating' if not available
    final pollType = item.pollType ?? 'rating';
    return VoteValueFormatter.format(item.value, pollType);
  }

  Widget _buildVoteDisplay() {
    final pollType = item.pollType ?? 'rating';

    // For rating and likert with numeric values, show stars
    if ((pollType == 'rating' || pollType == 'likert') && item.value is int) {
      return RatingStars(rating: item.value as int, size: 22);
    }

    // For all other types, show formatted text
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        _formatVoteValue(),
        style: const TextStyle(
          color: AppTheme.primary,
          fontWeight: FontWeight.w700,
          fontSize: 14,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  item.policyTitle ?? 'Deleted policy',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                ),
              ),
              const SizedBox(width: 8),
              if (item.hasComment || item.sentiment != null)
                _SentimentPill(sentiment: item.sentiment),
            ],
          ),
          if (item.policyCode != null) ...[
            const SizedBox(height: 5),
            Text(
              item.policyCode!,
              style: const TextStyle(
                color: AppTheme.primary,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              _buildVoteDisplay(),
              const Spacer(),
              Text(
                DateFormatters.compact(item.createdAt),
                style: const TextStyle(color: AppTheme.mutedText),
              ),
            ],
          ),
          if (item.hasComment) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF7F9FB),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                item.comment!,
                style: const TextStyle(color: AppTheme.text, height: 1.35),
              ),
            ),
          ] else ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onComment,
              icon: const Icon(Icons.add_comment_outlined),
              label: const Text('Add comment'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.primary,
                side: BorderSide(color: AppTheme.primary.withValues(alpha: 0.3)),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CommentSheet extends StatefulWidget {
  const _CommentSheet({required this.item});

  final VoteHistory item;

  @override
  State<_CommentSheet> createState() => _CommentSheetState();
}

class _CommentSheetState extends State<_CommentSheet> {
  final _commentController = TextEditingController();

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return BlocConsumer<VoteCubit, VoteState>(
      listener: (context, state) {
        if (state.status == RequestStatus.success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.message ?? 'Comment added.')),
          );
          Navigator.of(context).pop(true);
        }
        if (state.status == RequestStatus.failure && state.message != null) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(state.message!)));
        }
      },
      builder: (context, state) {
        return Container(
          margin: EdgeInsets.only(bottom: bottom),
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 22),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Add comment',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              Text(
                widget.item.policyTitle ?? 'Policy feedback',
                style: const TextStyle(color: AppTheme.mutedText),
              ),
              const SizedBox(height: 16),
              AppTextField(
                controller: _commentController,
                label: 'Comment',
                icon: Icons.chat_bubble_outline_rounded,
                maxLines: 5,
                maxLength: 500,
              ),
              const SizedBox(height: 12),
              AppButton(
                label: 'Submit comment',
                icon: Icons.send_rounded,
                loading: state.status == RequestStatus.loading,
                onPressed: () {
                  if (_commentController.text.trim().isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Comment is required.')),
                    );
                    return;
                  }
                  if (widget.item.policyId == null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                          content: Text('Policy information not available.')),
                    );
                    return;
                  }
                  context.read<VoteCubit>().addComment(
                        policyId: widget.item.policyId!,
                        comment: _commentController.text,
                      );
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SentimentPill extends StatelessWidget {
  const _SentimentPill({required this.sentiment});

  final String? sentiment;

  @override
  Widget build(BuildContext context) {
    final value = sentiment ?? 'pending';
    final color = switch (sentiment) {
      'positive' => AppTheme.primary,
      'negative' => const Color(0xFFE53E3E),
      'neutral' => const Color(0xFF62748A),
      _ => const Color(0xFFB7791F),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        value,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/error/api_exception.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/domain/repositories/auth_repository.dart';
import '../../domain/entities/comment.dart';
import '../cubit/comment_cubit.dart';
import '../cubit/comment_state.dart';
import '../cubit/profile_cubit.dart';
import 'edit_comment_dialog.dart';
import 'reply_comment_dialog.dart';
import 'report_comment_dialog.dart';

class CommentListWidget extends StatefulWidget {
  const CommentListWidget({
    required this.policyId,
    super.key,
  });

  final String policyId;

  @override
  State<CommentListWidget> createState() => _CommentListWidgetState();
}

class _CommentListWidgetState extends State<CommentListWidget> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    context.read<CommentCubit>().loadComments(
          policyId: widget.policyId,
          refresh: true,
        );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent * 0.9) {
      final state = context.read<CommentCubit>().state;
      if (state is CommentLoaded && state.hasMore) {
        context.read<CommentCubit>().loadMore(policyId: widget.policyId);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CommentCubit, CommentState>(
      listener: (context, state) {
        if (state is CommentAppealed) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.green.shade600,
            ),
          );
        }
      },
      builder: (context, state) {
        if (state is CommentLoading && state is! CommentLoaded) {
          return const Center(
              child: CircularProgressIndicator(color: AppTheme.primary));
        }

        if (state is CommentError) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline_rounded,
                    size: 48, color: Colors.red.shade300),
                const SizedBox(height: 16),
                Text(
                  'Error loading comments',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(state.message,
                    style: const TextStyle(color: AppTheme.mutedText)),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () {
                    context.read<CommentCubit>().loadComments(
                          policyId: widget.policyId,
                          refresh: true,
                        );
                  },
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.primary,
                    side: BorderSide(
                        color: AppTheme.primary.withValues(alpha: 0.3)),
                  ),
                ),
              ],
            ),
          );
        }

        if (state is CommentLoaded) {
          if (state.comments.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.forum_outlined, size: 64, color: AppTheme.border),
                  const SizedBox(height: 16),
                  const Text(
                    'No comments yet.',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Be the first to share your thoughts!',
                    style: TextStyle(color: AppTheme.mutedText),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: AppTheme.primary,
            backgroundColor: Colors.white,
            onRefresh: () async {
              await context.read<CommentCubit>().loadComments(
                    policyId: widget.policyId,
                    refresh: true,
                  );
            },
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.only(bottom: 32),
              itemCount: state.comments.length + (state.hasMore ? 1 : 0),
              itemBuilder: (context, index) {
                if (index >= state.comments.length) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(color: AppTheme.primary),
                    ),
                  );
                }

                final comment = state.comments[index];
                return _CommentCard(
                  comment: comment,
                  policyId: widget.policyId,
                );
              },
            ),
          );
        }

        return const Center(
          child: Text('No comments yet. Be the first to comment!',
              style: TextStyle(color: AppTheme.mutedText)),
        );
      },
    );
  }
}

class _CommentCard extends StatelessWidget {
  const _CommentCard({
    required this.comment,
    required this.policyId,
  });

  final Comment comment;
  final String policyId;

  void _showReportDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => BlocProvider.value(
        value: context.read<CommentCubit>(),
        child: ReportCommentDialog(commentId: comment.id),
      ),
    );
  }

  void _showEditDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => BlocProvider.value(
        value: context.read<CommentCubit>(),
        child: EditCommentDialog(
          commentId: comment.id,
          currentText: comment.text,
          policyId: policyId,
        ),
      ),
    );
  }

  void _showReplyDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => BlocProvider.value(
        value: context.read<CommentCubit>(),
        child: ReplyCommentDialog(
          policyId: policyId,
          parentComment: comment,
        ),
      ),
    );
  }

  bool _isCurrentUserAuthor() {
    final authRepo = serviceLocator<AuthRepository>();
    final session = authRepo.restoreSession();
    return session?.userId == comment.userId;
  }

  @override
  Widget build(BuildContext context) {
    final isReply = comment.parentCommentId != null;

    return Column(
      children: [
        Container(
          margin: EdgeInsets.only(
            left: isReply ? 40 : 20,
            right: 20,
            top: 8,
            bottom: 8,
          ),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppTheme.border),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isReply) ...[
                  Row(
                    children: [
                      Icon(
                        Icons.reply_rounded,
                        size: 16,
                        color: AppTheme.mutedText.withValues(alpha: 0.7),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Reply',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.mutedText.withValues(alpha: 0.7),
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],
                Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                      child: Text(
                        (comment.userEmail ?? 'A')
                            .substring(0, 1)
                            .toUpperCase(),
                        style: const TextStyle(
                          color: AppTheme.primary,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            comment.userEmail ?? 'Anonymous Citizen',
                            style: Theme.of(context)
                                .textTheme
                                .titleSmall
                                ?.copyWith(
                                  fontWeight: FontWeight.w800,
                                ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            _formatDate(comment.createdAt),
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.mutedText,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    _StatusChip(comment: comment),
                    IconButton(
                      icon: const Icon(Icons.more_horiz_rounded,
                          size: 22, color: AppTheme.mutedText),
                      onPressed: () => _showCommentMenu(context),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  comment.text,
                  style: const TextStyle(
                    height: 1.5,
                    fontSize: 15,
                    color: AppTheme.text,
                  ),
                ),
                _TranslationPanel(
                  commentId: comment.id,
                  text: comment.text,
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    if (comment.sentiment != null)
                      _SentimentChip(sentiment: comment.sentiment!),
                    if (comment.isEdited)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.edit_rounded,
                                size: 12, color: Colors.grey.shade600),
                            const SizedBox(width: 4),
                            Text('Edited',
                                style: TextStyle(
                                    color: Colors.grey.shade600,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                    if (comment.isOfficialReply)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.blue.shade100),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.verified_rounded,
                                size: 12, color: Colors.blue.shade700),
                            const SizedBox(width: 4),
                            Text('Official',
                                style: TextStyle(
                                    color: Colors.blue.shade700,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                  ],
                ),
                if (comment.keywords != null &&
                    comment.keywords!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: comment.keywords!
                        .take(3)
                        .map(
                          (keyword) => Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppTheme.background,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppTheme.border),
                            ),
                            child: Text(
                              '#$keyword',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.mutedText,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ],
                if (!isReply) ...[
                  const SizedBox(height: 16),
                  const Divider(height: 1),
                  const SizedBox(height: 12),
                  _RepliesSection(comment: comment, policyId: policyId),
                ],
              ],
            ),
          ),
        ),
        if (!isReply) _RepliesList(comment: comment, policyId: policyId),
      ],
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays > 0) {
      return '${diff.inDays}d ago';
    } else if (diff.inHours > 0) {
      return '${diff.inHours}h ago';
    } else if (diff.inMinutes > 0) {
      return '${diff.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }

  void _showCommentMenu(BuildContext context) {
    final isAuthor = _isCurrentUserAuthor();
    final cubit = context.read<CommentCubit>();

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (bottomSheetContext) => BlocProvider.value(
        value: cubit,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 5,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppTheme.border,
                      borderRadius: BorderRadius.circular(99),
                    ),
                  ),
                ),
                ListTile(
                  leading:
                      const Icon(Icons.reply_rounded, color: AppTheme.primary),
                  title: const Text('Reply',
                      style: TextStyle(fontWeight: FontWeight.w600)),
                  onTap: () {
                    Navigator.pop(bottomSheetContext);
                    _showReplyDialog(context);
                  },
                ),
                if (isAuthor && comment.isVisible) ...[
                  ListTile(
                    leading:
                        const Icon(Icons.edit_rounded, color: AppTheme.text),
                    title: const Text('Edit Comment',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                    onTap: () {
                      Navigator.pop(bottomSheetContext);
                      _showEditDialog(context);
                    },
                  ),
                ],
                if (!isAuthor)
                  ListTile(
                    leading:
                        const Icon(Icons.flag_rounded, color: Colors.orange),
                    title: const Text('Report Comment',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                    onTap: () {
                      Navigator.pop(bottomSheetContext);
                      _showReportDialog(context);
                    },
                  ),
                if (isAuthor && comment.canAppeal)
                  ListTile(
                    leading:
                        const Icon(Icons.gavel_rounded, color: Colors.blue),
                    title: const Text('Appeal Decision',
                        style: TextStyle(fontWeight: FontWeight.w600)),
                    onTap: () {
                      Navigator.pop(bottomSheetContext);
                      _showAppealDialog(context);
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showAppealDialog(BuildContext context) {
    final reasonController = TextEditingController();
    final cubit = context.read<CommentCubit>();

    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('Appeal Moderation',
            style: TextStyle(fontWeight: FontWeight.w800)),
        content: TextField(
          controller: reasonController,
          decoration: InputDecoration(
            hintText: 'Explain why this decision should be reconsidered...',
            hintStyle: const TextStyle(color: AppTheme.mutedText),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide(color: AppTheme.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: AppTheme.primary, width: 2),
            ),
          ),
          maxLines: 4,
          maxLength: 500,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            onPressed: () {
              if (reasonController.text.trim().isNotEmpty) {
                cubit.appealComment(
                  commentId: comment.id,
                  reason: reasonController.text,
                  policyId: policyId,
                );
                Navigator.pop(dialogContext);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              elevation: 0,
            ),
            child: const Text('Submit Appeal',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

class _TranslationPanel extends StatefulWidget {
  const _TranslationPanel({
    required this.commentId,
    required this.text,
  });

  final String commentId;
  final String text;

  @override
  State<_TranslationPanel> createState() => _TranslationPanelState();
}

class _TranslationPanelState extends State<_TranslationPanel> {
  bool _loading = false;
  String? _translatedText;
  String? _error;

  Future<void> _translate() async {
    if (_loading) return;
    var targetLang = 'en';
    try {
      targetLang =
          context.read<ProfileCubit>().state.profile?.preferredLanguage ?? 'en';
    } catch (_) {
      targetLang = 'en';
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final translated = await context.read<CommentCubit>().translateText(
            text: widget.text,
            targetLang: targetLang,
          );
      if (!mounted) return;
      setState(() {
        _translatedText = translated.isEmpty ? null : translated;
        _error = translated.isEmpty ? 'No translation returned.' : null;
      });
    } catch (error) {
      if (!mounted) return;
      final message = error is ApiException
          ? error.message
          : 'Translation is unavailable right now. Please try again later.';
      setState(() => _error = message);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    var targetLang = 'en';
    try {
      targetLang =
          context.watch<ProfileCubit>().state.profile?.preferredLanguage ??
              'en';
    } catch (_) {
      targetLang = 'en';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 10),
        TextButton.icon(
          onPressed: _loading ? null : _translate,
          icon: _loading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.translate_rounded, size: 18),
          label: Text('Translate to ${_languageName(targetLang)}'),
          style: TextButton.styleFrom(
            foregroundColor: AppTheme.primary,
            padding: EdgeInsets.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
        if (_translatedText != null) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppTheme.primary.withValues(alpha: 0.15),
              ),
            ),
            child: Text(
              _translatedText!,
              style: const TextStyle(
                color: AppTheme.text,
                height: 1.45,
              ),
            ),
          ),
        ],
        if (_error != null) ...[
          const SizedBox(height: 6),
          Text(
            _error!,
            style: const TextStyle(color: Colors.redAccent, fontSize: 12),
          ),
        ],
      ],
    );
  }

  String _languageName(String code) {
    switch (code) {
      case 'am':
        return 'Amharic';
      case 'om':
        return 'Oromo';
      case 'ti':
        return 'Tigrinya';
      default:
        return 'English';
    }
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.comment});

  final Comment comment;

  @override
  Widget build(BuildContext context) {
    Color color;
    String label;

    if (comment.isHidden) {
      switch (comment.hiddenReason) {
        case 'profanity':
          color = Colors.red;
          label = 'Blocked';
        case 'reports':
          color = Colors.orange;
          label = 'Flagged';
        case 'moderator':
          color = Colors.red;
          label = 'Deleted';
        default:
          color = Colors.red;
          label = 'Hidden';
      }
    } else {
      switch (comment.moderationStatus) {
        case 'pending_ai':
          color = Colors.blue;
          label = 'Processing';
        case 'needs_review':
          color = Colors.orange;
          label = 'Under Review';
        case 'reviewed':
          color = Colors.green;
          label = 'Reviewed';
        case 'none':
          return const SizedBox.shrink();
        default:
          color = Colors.grey;
          label = comment.moderationStatus;
      }
    }

    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label,
        style: TextStyle(
            color: color,
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5),
      ),
    );
  }
}

class _SentimentChip extends StatelessWidget {
  const _SentimentChip({required this.sentiment});

  final CommentSentiment sentiment;

  @override
  Widget build(BuildContext context) {
    Color color;
    IconData icon;
    Color bgColor;

    switch (sentiment.label) {
      case 'positive':
        color = Colors.green.shade700;
        bgColor = Colors.green.shade50;
        icon = Icons.sentiment_satisfied_rounded;
      case 'negative':
        color = Colors.red.shade700;
        bgColor = Colors.red.shade50;
        icon = Icons.sentiment_dissatisfied_rounded;
      default:
        color = Colors.grey.shade700;
        bgColor = Colors.grey.shade100;
        icon = Icons.sentiment_neutral_rounded;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            sentiment.label.toUpperCase(),
            style: TextStyle(
                color: color,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5),
          ),
        ],
      ),
    );
  }
}

class _RepliesSection extends StatelessWidget {
  const _RepliesSection({
    required this.comment,
    required this.policyId,
  });

  final Comment comment;
  final String policyId;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CommentCubit, CommentState>(
      builder: (context, state) {
        final cubit = context.read<CommentCubit>();
        final repliesLoaded = cubit.areRepliesLoaded(comment.id);
        final repliesLoading = cubit.areRepliesLoading(comment.id);
        final replies = cubit.getReplies(comment.id);

        if (repliesLoading) {
          return Row(
            children: [
              const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppTheme.primary),
              ),
              const SizedBox(width: 8),
              Text(
                'Loading replies...',
                style: TextStyle(
                  color: AppTheme.primary.withValues(alpha: 0.7),
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          );
        }

        if (!repliesLoaded) {
          return TextButton.icon(
            onPressed: () => cubit.loadReplies(comment.id),
            icon: const Icon(Icons.forum_outlined, size: 16),
            label: const Text('View replies'),
            style: TextButton.styleFrom(
              foregroundColor: AppTheme.primary,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
          );
        }

        if (replies.isEmpty) {
          return const Text(
            'No replies yet',
            style: TextStyle(
              color: AppTheme.mutedText,
              fontSize: 13,
              fontStyle: FontStyle.italic,
              fontWeight: FontWeight.w500,
            ),
          );
        }

        return TextButton.icon(
          onPressed: () => cubit.loadReplies(comment.id),
          icon: const Icon(Icons.refresh_rounded, size: 16),
          label: Text(
              '${replies.length} ${replies.length == 1 ? 'reply' : 'replies'}'),
          style: TextButton.styleFrom(
            foregroundColor: AppTheme.primary,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            backgroundColor: AppTheme.primary.withValues(alpha: 0.05),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      },
    );
  }
}

class _RepliesList extends StatelessWidget {
  const _RepliesList({
    required this.comment,
    required this.policyId,
  });

  final Comment comment;
  final String policyId;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<CommentCubit, CommentState>(
      builder: (context, state) {
        final cubit = context.read<CommentCubit>();
        final repliesLoaded = cubit.areRepliesLoaded(comment.id);
        final replies = cubit.getReplies(comment.id);

        if (!repliesLoaded || replies.isEmpty) {
          return const SizedBox.shrink();
        }

        return Column(
          children: replies
              .map((reply) => _CommentCard(
                    comment: reply,
                    policyId: policyId,
                  ))
              .toList(),
        );
      },
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/state/request_status.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_formatters.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/policy.dart';
import '../../domain/entities/vote_value.dart';
import '../../domain/repositories/citizen_repository.dart';
import '../cubit/comment_cubit.dart';
import '../cubit/history_cubit.dart';
import '../cubit/policy_cubit.dart';
import '../cubit/vote_cubit.dart';
import '../widgets/approval_vote_widget.dart';
import '../widgets/binary_vote_widget.dart';
import '../widgets/comment_list_widget.dart';
import '../widgets/likert_vote_widget.dart';
import '../widgets/multiple_choice_vote_widget.dart';
import '../widgets/post_comment_widget.dart';
import '../widgets/ranked_choice_vote_widget.dart';
import '../widgets/rating_stars.dart';
import '../widgets/status_pill.dart';

class PolicyDetailPage extends StatefulWidget {
  const PolicyDetailPage({
    required this.policyId,
    required this.initialPolicy,
    super.key,
  });

  final String policyId;
  final Policy initialPolicy;

  @override
  State<PolicyDetailPage> createState() => _PolicyDetailPageState();
}

class _PolicyDetailPageState extends State<PolicyDetailPage> {
  bool _initialLoadAttempted = false;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      if (mounted && !_initialLoadAttempted) {
        _initialLoadAttempted = true;
        context.read<PolicyCubit>().loadPolicy(widget.policyId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PolicyCubit, PolicyState>(
      builder: (context, state) {
        final selected = state.selectedPolicy?.id == widget.policyId
            ? state.selectedPolicy
            : null;
        final policy = selected ?? widget.initialPolicy;
        final failed =
            state.detailStatus == RequestStatus.failure && selected == null;

        return DefaultTabController(
          length: 2,
          child: Scaffold(
            appBar: AppBar(
              title: const Text('Policy Details'),
              elevation: 0,
              bottom: TabBar(
                indicatorColor: AppTheme.primary,
                indicatorWeight: 3,
                indicatorSize: TabBarIndicatorSize.tab,
                labelColor: AppTheme.primary,
                unselectedLabelColor: AppTheme.mutedText,
                labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
                unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                tabs: const [
                  Tab(text: 'Overview', icon: Icon(Icons.info_outline_rounded)),
                  Tab(text: 'Discussion', icon: Icon(Icons.forum_outlined)),
                ],
              ),
            ),
            body: failed
                ? ErrorView(
                    message: state.message ?? 'Policy could not be loaded.',
                    onRetry: () => context.read<PolicyCubit>().loadPolicy(
                          widget.policyId,
                        ),
                  )
                : TabBarView(
                    children: [
                      RefreshIndicator(
                        onRefresh: () => context.read<PolicyCubit>().loadPolicy(
                              widget.policyId,
                            ),
                        color: AppTheme.primary,
                        backgroundColor: Colors.white,
                        child: ListView(
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                          children: [
                            if (state.detailStatus == RequestStatus.loading)
                              const Padding(
                                padding: EdgeInsets.only(bottom: 16),
                                child: LinearProgressIndicator(minHeight: 3, borderRadius: BorderRadius.all(Radius.circular(2))),
                              ),
                            _DetailHeader(policy: policy),
                            const SizedBox(height: 16),
                            _DescriptionCard(policy: policy),
                            const SizedBox(height: 16),
                            _VotingCard(
                              policy: policy,
                              onVote: () => _showVoteSheet(context, policy),
                            ),
                          ],
                        ),
                      ),
                      _CommentsTab(policy: policy),
                    ],
                  ),
          ),
        );
      },
    );
  }

  Future<void> _showVoteSheet(BuildContext context, Policy policy) async {
    final policyCubit = context.read<PolicyCubit>();
    final historyCubit = context.read<HistoryCubit>();
    final voted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => BlocProvider.value(
        value: context.read<VoteCubit>(),
        child: _VoteSheet(policy: policy),
      ),
    );

    if (!mounted || voted != true) return;
    policyCubit.loadPolicy(policy.id);
    policyCubit.loadPolicies();
    historyCubit.loadHistory();
  }
}

class _DetailHeader extends StatelessWidget {
  const _DetailHeader({required this.policy});

  final Policy policy;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  policy.title,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    height: 1.25,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              StatusPill(status: policy.status),
            ],
          ),
          const SizedBox(height: 20),
          const Divider(height: 1),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _InfoChip(
                icon: Icons.tag_rounded,
                label: policy.policyCode,
              ),
              if (policy.averageRating != null)
                _InfoChip(
                  icon: Icons.star_rounded,
                  label: '${policy.averageRating!.toStringAsFixed(1)} avg',
                  iconColor: Colors.amber.shade600,
                  backgroundColor: Colors.amber.shade50,
                  textColor: Colors.amber.shade900,
                ),
              _InfoChip(
                icon: Icons.how_to_vote_rounded,
                label: '${policy.totalVotes} votes',
              ),
              if (policy.topics != null && policy.topics!.isNotEmpty)
                ...policy.topics!.take(2).map(
                      (topic) => _InfoChip(
                        icon: Icons.label_outline_rounded,
                        label: topic,
                      ),
                    ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DescriptionCard extends StatelessWidget {
  const _DescriptionCard({required this.policy});

  final Policy policy;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'About this policy',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            policy.description,
            style: const TextStyle(
              color: AppTheme.text,
              height: 1.6,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.background,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                _DetailRow(
                  icon: Icons.map_outlined,
                  label: 'Regions',
                  value: policy.targetRegions.isEmpty
                      ? 'Not specified'
                      : policy.targetRegions.join(', '),
                ),
                const SizedBox(height: 12),
                _DetailRow(
                  icon: Icons.event_available_outlined,
                  label: 'Starts',
                  value: DateFormatters.short(policy.startDate),
                ),
                const SizedBox(height: 12),
                _DetailRow(
                  icon: Icons.event_busy_outlined,
                  label: 'Ends',
                  value: DateFormatters.short(policy.endDate),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _VotingCard extends StatelessWidget {
  const _VotingCard({required this.policy, required this.onVote});

  final Policy policy;
  final VoidCallback onVote;

  @override
  Widget build(BuildContext context) {
    final title = policy.canVote ? 'Ready for your feedback' : 'Voting paused';
    final message = policy.canVote
        ? 'Submit one rating for this policy. A comment is optional.'
        : 'This policy is visible, but voting is temporarily paused.';

    return AppCard(
      margin: EdgeInsets.zero,
      padding: const EdgeInsets.all(24),
      color: policy.canVote ? AppTheme.primary.withValues(alpha: 0.03) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                policy.canVote ? Icons.feedback_rounded : Icons.pause_circle_filled_rounded,
                color: policy.canVote ? AppTheme.primary : AppTheme.mutedText,
                size: 24,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.3,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            message, 
            style: TextStyle(
              color: AppTheme.text.withValues(alpha: 0.7),
              height: 1.5,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          AppButton(
            label: 'Vote on Policy',
            icon: Icons.how_to_vote_rounded,
            onPressed: policy.canVote ? onVote : null,
          ),
        ],
      ),
    );
  }
}

class _VoteSheet extends StatefulWidget {
  const _VoteSheet({required this.policy});

  final Policy policy;

  @override
  State<_VoteSheet> createState() => _VoteSheetState();
}

class _VoteSheetState extends State<_VoteSheet> {
  dynamic _voteValue;
  final _commentController = TextEditingController();

  @override
  void initState() {
    super.initState();
    switch (widget.policy.pollType) {
      case 'rating':
      case 'likert':
        _voteValue = 5;
        break;
      case 'binary':
      case 'approval':
      case 'multipleChoice':
        if (widget.policy.pollType == 'multipleChoice') _voteValue = <String>[];
        else _voteValue = null;
        break;
      case 'rankedChoice':
        _voteValue = <String>[];
        break;
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  bool get _canSubmit {
    return VoteValueFormatter.isValid(
      _voteValue,
      widget.policy.pollType,
      maxSelections: widget.policy.maxSelections,
      maxRank: widget.policy.rankedChoiceMaxRank,
    );
  }

  String get _pollTypeLabel {
    switch (widget.policy.pollType) {
      case 'binary': return 'Vote Yes or No';
      case 'multipleChoice': return 'Select Options';
      case 'likert': return 'Rate on Scale';
      case 'approval': return 'Approve or Reject';
      case 'rating': return 'Rate Policy';
      case 'rankedChoice': return 'Rank Choices';
      default: return 'Vote on Policy';
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return BlocConsumer<VoteCubit, VoteState>(
      listener: (context, state) {
        if (state.status == RequestStatus.success) {
          final message = state.message ??
              (state.alreadyVoted
                  ? 'You have already voted on this policy.'
                  : 'Vote submitted successfully!');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(message),
              backgroundColor: state.alreadyVoted ? Colors.orange.shade700 : Colors.green.shade600,
            ),
          );
          Navigator.of(context).pop(true);
        } else if (state.status == RequestStatus.failure) {
          final errorMessage = state.message ?? 'Failed to submit vote. Please try again.';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(errorMessage),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      },
      builder: (context, state) {
        return Container(
          margin: EdgeInsets.only(bottom: bottom),
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 48,
                  height: 6,
                  decoration: BoxDecoration(
                    color: AppTheme.border,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                _pollTypeLabel,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                widget.policy.title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppTheme.mutedText,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 32),
              _buildVoteWidget(),
              const SizedBox(height: 24),
              AppTextField(
                controller: _commentController,
                label: 'Add a comment (optional)',
                hint: 'Share your thoughts on this policy...',
                icon: Icons.chat_bubble_outline_rounded,
                maxLines: 4,
                maxLength: 2000,
              ),
              const SizedBox(height: 24),
              AppButton(
                label: 'Submit Vote',
                icon: Icons.send_rounded,
                loading: state.status == RequestStatus.loading,
                onPressed: _canSubmit
                    ? () => context.read<VoteCubit>().submitVote(
                          policyId: widget.policy.id,
                          value: _voteValue,
                          comment: _commentController.text,
                        )
                    : null,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVoteWidget() {
    switch (widget.policy.pollType) {
      case 'binary':
        return BinaryVoteWidget(
          value: _voteValue as String?,
          onChanged: (value) => setState(() => _voteValue = value),
        );
      case 'approval':
        return ApprovalVoteWidget(
          value: _voteValue as String?,
          onChanged: (value) => setState(() => _voteValue = value),
        );
      case 'likert':
        return LikertVoteWidget(
          value: _voteValue as int?,
          labels: widget.policy.likertLabels ?? [],
          onChanged: (value) => setState(() => _voteValue = value),
        );
      case 'multipleChoice':
        return MultipleChoiceVoteWidget(
          options: widget.policy.pollOptions ?? [],
          selectedIds: _voteValue as List<String>,
          maxSelections: widget.policy.maxSelections ?? 1,
          onChanged: (value) => setState(() => _voteValue = value),
        );
      case 'rankedChoice':
        return RankedChoiceVoteWidget(
          options: widget.policy.pollOptions ?? [],
          rankedIds: _voteValue as List<String>,
          maxRank: widget.policy.rankedChoiceMaxRank ?? 3,
          onChanged: (value) => setState(() => _voteValue = value),
        );
      case 'rating':
      default:
        return Center(
          child: RatingStars(
            rating: _voteValue as int? ?? 5,
            onChanged: (value) => setState(() => _voteValue = value),
            size: 40,
          ),
        );
    }
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({
    required this.icon, 
    required this.label,
    this.iconColor,
    this.backgroundColor,
    this.textColor,
  });

  final IconData icon;
  final String label;
  final Color? iconColor;
  final Color? backgroundColor;
  final Color? textColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor ?? AppTheme.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: iconColor ?? AppTheme.primary),
          const SizedBox(width: 8),
          Text(
            label,
            style: TextStyle(
              color: textColor ?? AppTheme.primary,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 20, color: AppTheme.mutedText),
        const SizedBox(width: 12),
        SizedBox(
          width: 80,
          child: Text(
            label,
            style: const TextStyle(
              color: AppTheme.mutedText,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(
              color: AppTheme.text,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
        ),
      ],
    );
  }
}

class _CommentsTab extends StatelessWidget {
  const _CommentsTab({required this.policy});

  final Policy policy;

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => CommentCubit(serviceLocator<CitizenRepository>()),
      child: Builder(
        builder: (context) => Column(
          children: [
            PostCommentWidget(
              policyId: policy.id,
              onCommentPosted: () {
                context.read<CommentCubit>().loadComments(
                      policyId: policy.id,
                      refresh: true,
                    );
              },
            ),
            Expanded(
              child: CommentListWidget(policyId: policy.id),
            ),
          ],
        ),
      ),
    );
  }
}

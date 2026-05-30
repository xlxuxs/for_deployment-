import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/state/request_status.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/date_formatters.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/empty_state.dart';
import '../../../../core/widgets/error_view.dart';
import '../../domain/entities/policy.dart';
import '../cubit/history_cubit.dart';
import '../cubit/policy_cubit.dart';
import '../cubit/profile_cubit.dart';
import '../cubit/vote_cubit.dart';
import '../widgets/status_pill.dart';
import 'policy_detail_page.dart';

class PolicyListPage extends StatelessWidget {
  const PolicyListPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Policies'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => context.read<PolicyCubit>().loadPolicies(),
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => context.read<PolicyCubit>().loadPolicies(),
        color: AppTheme.primary,
        backgroundColor: Colors.white,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            const SliverToBoxAdapter(child: SizedBox(height: 12)),
            const SliverToBoxAdapter(child: _PolicyHeader()),
            const SliverToBoxAdapter(child: SizedBox(height: 8)),
            const SliverToBoxAdapter(child: _FilterChips()),
            BlocBuilder<PolicyCubit, PolicyState>(
              builder: (context, state) {
                if (state.status == RequestStatus.loading &&
                    state.policies.isEmpty) {
                  return const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  );
                }

                if (state.status == RequestStatus.failure &&
                    state.policies.isEmpty) {
                  return SliverFillRemaining(
                    child: ErrorView(
                      message: state.message ?? 'Failed to load policies.',
                      onRetry: () => context.read<PolicyCubit>().loadPolicies(),
                    ),
                  );
                }

                if (state.policies.isEmpty) {
                  return const SliverFillRemaining(
                    child: EmptyState(
                      icon: Icons.policy_outlined,
                      title: 'No policies available',
                      message:
                          'Active and paused policies for your region will appear here.',
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  sliver: SliverList.builder(
                    itemCount: state.policies.length + (state.hasMore ? 1 : 0),
                    itemBuilder: (context, index) {
                      if (index >= state.policies.length) {
                        return Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: OutlinedButton.icon(
                            onPressed:
                                () => context.read<PolicyCubit>().loadPolicies(
                                  refresh: false,
                                ),
                            icon: const Icon(Icons.expand_more_rounded),
                            label: const Text('Load more'),
                          ),
                        );
                      }
                      final policy = state.policies[index];
                      return _PolicyCard(
                        policy: policy,
                        onTap: () => _openPolicy(context, policy),
                      );
                    },
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  void _openPolicy(BuildContext context, Policy policy) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder:
            (_) => MultiBlocProvider(
              providers: [
                BlocProvider.value(value: context.read<PolicyCubit>()),
                BlocProvider.value(value: context.read<VoteCubit>()),
                BlocProvider.value(value: context.read<HistoryCubit>()),
              ],
              child: PolicyDetailPage(
                policyId: policy.id,
                initialPolicy: policy,
              ),
            ),
      ),
    );
  }
}

class _PolicyHeader extends StatelessWidget {
  const _PolicyHeader();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: BlocBuilder<ProfileCubit, ProfileState>(
        builder: (context, state) {
          final region = state.profile?.region ?? 'Your Region';
          return Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              gradient: LinearGradient(
                colors: [
                  AppTheme.primary,
                  AppTheme.primary.withValues(alpha: 0.8),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primary.withValues(alpha: 0.25),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.4), width: 1),
                  ),
                  child: const Icon(
                    Icons.location_city_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Citizen Workspace',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.5,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        region,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips();

  static const List<String> availableTopics = [
    'Agriculture',
    'Water',
    'Infrastructure',
    'Health',
    'Education',
    'Transportation',
    'Environment',
    'Economy',
    'Security',
    'Technology',
  ];

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<PolicyCubit, PolicyState>(
      builder: (context, state) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  _statusChip(context, 'All', 'all', state.filter),
                  const SizedBox(width: 10),
                  _statusChip(context, 'Active', 'active', state.filter),
                  const SizedBox(width: 10),
                  _statusChip(context, 'Paused', 'paused', state.filter),
                  const SizedBox(width: 12),
                  Container(
                    width: 1,
                    height: 24,
                    color: AppTheme.border,
                  ),
                  const SizedBox(width: 12),
                  ActionChip(
                    onPressed: () => _showTopicFilterSheet(context, state.topicFilters),
                    avatar: const Icon(Icons.tune_rounded, size: 18),
                    label: Text(state.topicFilters.isEmpty ? 'Topics' : '${state.topicFilters.length} Topics'),
                    backgroundColor: state.topicFilters.isEmpty ? Colors.white : AppTheme.primary.withValues(alpha: 0.1),
                    side: BorderSide(
                      color: state.topicFilters.isEmpty ? AppTheme.border : AppTheme.primary.withValues(alpha: 0.3),
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    labelStyle: TextStyle(
                      color: state.topicFilters.isEmpty ? AppTheme.text : AppTheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            
            if (state.topicFilters.isNotEmpty) ...[
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(
                  children: [
                    TextButton.icon(
                      onPressed: () => context.read<PolicyCubit>().clearTopicFilters(),
                      icon: const Icon(Icons.clear_all_rounded, size: 16),
                      label: const Text('Clear'),
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.redAccent,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        minimumSize: const Size(0, 32),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ...state.topicFilters.map((topic) {
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Chip(
                          label: Text(topic),
                          deleteIcon: const Icon(Icons.close_rounded, size: 16),
                          onDeleted: () => context.read<PolicyCubit>().removeTopicFilter(topic),
                          backgroundColor: AppTheme.primary.withValues(alpha: 0.08),
                          labelStyle: const TextStyle(
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                          deleteIconColor: AppTheme.primary,
                          side: BorderSide.none,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),
          ],
        );
      },
    );
  }

  Widget _statusChip(
    BuildContext context,
    String label,
    String value,
    String selected,
  ) {
    final active = selected == value;
    return ChoiceChip(
      label: Text(label),
      selected: active,
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      onSelected:
          (_) => context.read<PolicyCubit>().loadPolicies(status: value),
      selectedColor: AppTheme.text,
      backgroundColor: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: active ? AppTheme.text : AppTheme.border),
      ),
      labelStyle: TextStyle(
        color: active ? Colors.white : AppTheme.mutedText,
        fontWeight: FontWeight.w700,
      ),
    );
  }

  void _showTopicFilterSheet(BuildContext context, List<String> selectedTopics) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Filter by Topic',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.pop(sheetContext),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: availableTopics.map((topic) {
                  final isSelected = selectedTopics.contains(topic);
                  return FilterChip(
                    label: Text(topic),
                    selected: isSelected,
                    onSelected: (selected) {
                      if (selected) {
                        context.read<PolicyCubit>().addTopicFilter(topic);
                      } else {
                        context.read<PolicyCubit>().removeTopicFilter(topic);
                      }
                      Navigator.pop(sheetContext);
                    },
                    selectedColor: AppTheme.primary.withValues(alpha: 0.15),
                    checkmarkColor: AppTheme.primary,
                    backgroundColor: const Color(0xFFF0F4F8),
                    side: BorderSide(
                      color: isSelected ? AppTheme.primary : Colors.transparent,
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    labelStyle: TextStyle(
                      color: isSelected ? AppTheme.primary : AppTheme.text,
                      fontWeight: FontWeight.w600,
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

class _PolicyCard extends StatelessWidget {
  const _PolicyCard({required this.policy, required this.onTap});

  final Policy policy;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      margin: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  policy.title,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                    height: 1.3,
                    letterSpacing: -0.3,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              StatusPill(status: policy.status),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            policy.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppTheme.text.withValues(alpha: 0.7), 
              height: 1.5,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          const Divider(height: 1),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            children: [
              _Metric(icon: Icons.tag_rounded, text: policy.policyCode),
              if (policy.averageRating != null)
                _Metric(
                  icon: Icons.star_rounded,
                  text: policy.averageRating!.toStringAsFixed(1),
                  iconColor: Colors.amber.shade600,
                ),
              _Metric(
                icon: Icons.how_to_vote_rounded,
                text: '${policy.totalVotes} votes',
              ),
              _Metric(
                icon: Icons.event_rounded,
                text: DateFormatters.compact(policy.endDate),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.icon, required this.text, this.iconColor});

  final IconData icon;
  final String text;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 18, color: iconColor ?? AppTheme.primary),
        const SizedBox(width: 6),
        Text(
          text,
          style: const TextStyle(
            color: AppTheme.text,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}

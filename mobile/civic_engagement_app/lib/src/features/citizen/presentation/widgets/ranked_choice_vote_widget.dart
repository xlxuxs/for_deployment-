import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../domain/entities/policy.dart';

class RankedChoiceVoteWidget extends StatelessWidget {
  const RankedChoiceVoteWidget({
    required this.options,
    required this.rankedIds,
    required this.maxRank,
    required this.onChanged,
    super.key,
  });

  final List<PollOption> options;
  final List<String> rankedIds;
  final int maxRank;
  final ValueChanged<List<String>> onChanged;

  void _addToRanking(String optionId) {
    if (rankedIds.length < maxRank && !rankedIds.contains(optionId)) {
      onChanged([...rankedIds, optionId]);
    }
  }

  void _removeFromRanking(String optionId) {
    final newRanking = List<String>.from(rankedIds);
    newRanking.remove(optionId);
    onChanged(newRanking);
  }

  void _reorder(int oldIndex, int newIndex) {
    final newRanking = List<String>.from(rankedIds);
    if (newIndex > oldIndex) {
      newIndex -= 1;
    }
    final item = newRanking.removeAt(oldIndex);
    newRanking.insert(newIndex, item);
    onChanged(newRanking);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Rank up to $maxRank option${maxRank > 1 ? 's' : ''} in order of preference',
          style: TextStyle(
            fontSize: 13,
            color: Colors.grey.shade600,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        if (rankedIds.isNotEmpty) ...[
          Text(
            'Your ranking (drag to reorder):',
            style: TextStyle(
              fontSize: 13,
              color: AppTheme.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          ReorderableListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            onReorder: _reorder,
            itemCount: rankedIds.length,
            itemBuilder: (context, index) {
              final optionId = rankedIds[index];
              final option = options.firstWhere((o) => o.id == optionId);
              return _RankedOption(
                key: ValueKey(optionId),
                rank: index + 1,
                option: option,
                onRemove: () => _removeFromRanking(optionId),
              );
            },
          ),
          const SizedBox(height: 16),
        ],
        Text(
          'Available options:',
          style: TextStyle(
            fontSize: 13,
            color: Colors.grey.shade600,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 8),
        ...options.where((o) => !rankedIds.contains(o.id)).map(
              (option) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _AvailableOption(
                  option: option,
                  disabled: rankedIds.length >= maxRank,
                  onTap: () => _addToRanking(option.id),
                ),
              ),
            ),
      ],
    );
  }
}

class _RankedOption extends StatelessWidget {
  const _RankedOption({
    required this.rank,
    required this.option,
    required this.onRemove,
    super.key,
  });

  final int rank;
  final PollOption option;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.1),
        border: Border.all(color: AppTheme.primary, width: 2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.drag_handle, color: AppTheme.primary, size: 20),
          const SizedBox(width: 8),
          Container(
            width: 28,
            height: 28,
            decoration: const BoxDecoration(
              color: AppTheme.primary,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '$rank',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              option.text,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppTheme.primary,
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 20),
            color: Colors.red,
            onPressed: onRemove,
          ),
        ],
      ),
    );
  }
}

class _AvailableOption extends StatelessWidget {
  const _AvailableOption({
    required this.option,
    required this.disabled,
    required this.onTap,
  });

  final PollOption option;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: disabled ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: disabled ? Colors.grey.shade50 : Colors.grey.shade100,
          border: Border.all(
            color: disabled ? Colors.grey.shade200 : Colors.grey.shade300,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              Icons.add_circle_outline,
              color: disabled ? Colors.grey.shade300 : AppTheme.primary,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                option.text,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: disabled ? Colors.grey.shade400 : Colors.grey.shade800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

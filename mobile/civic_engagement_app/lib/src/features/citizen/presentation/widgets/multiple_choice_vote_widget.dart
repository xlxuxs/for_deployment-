import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../domain/entities/policy.dart';

class MultipleChoiceVoteWidget extends StatelessWidget {
  const MultipleChoiceVoteWidget({
    required this.options,
    required this.selectedIds,
    required this.maxSelections,
    required this.onChanged,
    super.key,
  });

  final List<PollOption> options;
  final List<String> selectedIds;
  final int maxSelections;
  final ValueChanged<List<String>> onChanged;

  void _toggleOption(String optionId) {
    final newSelection = List<String>.from(selectedIds);
    if (newSelection.contains(optionId)) {
      newSelection.remove(optionId);
    } else {
      if (newSelection.length < maxSelections) {
        newSelection.add(optionId);
      }
    }
    onChanged(newSelection);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Select up to $maxSelections option${maxSelections > 1 ? 's' : ''}',
          style: TextStyle(
            fontSize: 13,
            color: Colors.grey.shade600,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 12),
        ...options.map(
          (option) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _OptionTile(
              option: option,
              selected: selectedIds.contains(option.id),
              disabled: !selectedIds.contains(option.id) && selectedIds.length >= maxSelections,
              onTap: () => _toggleOption(option.id),
            ),
          ),
        ),
      ],
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.option,
    required this.selected,
    required this.disabled,
    required this.onTap,
  });

  final PollOption option;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: disabled ? null : onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected
              ? AppTheme.primary.withValues(alpha: 0.1)
              : disabled
                  ? Colors.grey.shade50
                  : Colors.grey.shade100,
          border: Border.all(
            color: selected
                ? AppTheme.primary
                : disabled
                    ? Colors.grey.shade200
                    : Colors.grey.shade300,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: selected ? AppTheme.primary : Colors.transparent,
                border: Border.all(
                  color: selected ? AppTheme.primary : Colors.grey.shade400,
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(6),
              ),
              child: selected
                  ? const Icon(
                      Icons.check,
                      size: 16,
                      color: Colors.white,
                    )
                  : null,
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
            if (option.shortCode.isNotEmpty)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.grey.shade200,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  option.shortCode,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Colors.grey.shade700,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

class BinaryVoteWidget extends StatelessWidget {
  const BinaryVoteWidget({
    required this.value,
    required this.onChanged,
    super.key,
  });

  final String? value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _OptionButton(
            label: 'Yes',
            icon: Icons.check_circle_outline_rounded,
            selected: value == 'yes',
            onTap: () => onChanged('yes'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _OptionButton(
            label: 'No',
            icon: Icons.cancel_outlined,
            selected: value == 'no',
            onTap: () => onChanged('no'),
            color: Colors.red,
          ),
        ),
      ],
    );
  }
}

class _OptionButton extends StatelessWidget {
  const _OptionButton({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
    this.color,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? AppTheme.primary;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: selected ? effectiveColor.withValues(alpha: 0.1) : Colors.grey.shade100,
          border: Border.all(
            color: selected ? effectiveColor : Colors.grey.shade300,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 40,
              color: selected ? effectiveColor : Colors.grey.shade600,
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: selected ? effectiveColor : Colors.grey.shade700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

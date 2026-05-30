import 'package:flutter/material.dart';

class ApprovalVoteWidget extends StatelessWidget {
  const ApprovalVoteWidget({
    required this.value,
    required this.onChanged,
    super.key,
  });

  final String? value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _OptionTile(
          label: 'Approve',
          icon: Icons.thumb_up_outlined,
          description: 'I support this policy',
          selected: value == 'approve',
          onTap: () => onChanged('approve'),
          color: Colors.green,
        ),
        const SizedBox(height: 12),
        _OptionTile(
          label: 'Reject',
          icon: Icons.thumb_down_outlined,
          description: 'I oppose this policy',
          selected: value == 'reject',
          onTap: () => onChanged('reject'),
          color: Colors.red,
        ),
        const SizedBox(height: 12),
        _OptionTile(
          label: 'Abstain',
          icon: Icons.remove_circle_outline,
          description: 'I have no strong opinion',
          selected: value == 'abstain',
          onTap: () => onChanged('abstain'),
          color: Colors.grey,
        ),
      ],
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.label,
    required this.icon,
    required this.description,
    required this.selected,
    required this.onTap,
    required this.color,
  });

  final String label;
  final IconData icon;
  final String description;
  final bool selected;
  final VoidCallback onTap;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected ? color.withValues(alpha: 0.1) : Colors.grey.shade100,
          border: Border.all(
            color: selected ? color : Colors.grey.shade300,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 32,
              color: selected ? color : Colors.grey.shade600,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: selected ? color : Colors.grey.shade800,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ],
              ),
            ),
            if (selected)
              Icon(
                Icons.check_circle,
                color: color,
                size: 24,
              ),
          ],
        ),
      ),
    );
  }
}

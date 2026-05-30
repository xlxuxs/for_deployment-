import 'package:flutter/material.dart';

class LikertVoteWidget extends StatelessWidget {
  const LikertVoteWidget({
    required this.value,
    required this.labels,
    required this.onChanged,
    super.key,
  });

  final int? value;
  final List<String> labels;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(5, (index) {
        final rating = index + 1;
        final label = labels.length >= 5 ? labels[index] : 'Option $rating';
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _LikertOption(
            rating: rating,
            label: label,
            selected: value == rating,
            onTap: () => onChanged(rating),
          ),
        );
      }),
    );
  }
}

class _LikertOption extends StatelessWidget {
  const _LikertOption({
    required this.rating,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final int rating;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  Color get _color {
    switch (rating) {
      case 1:
        return Colors.red;
      case 2:
        return Colors.orange;
      case 3:
        return Colors.amber;
      case 4:
        return Colors.lightGreen;
      case 5:
        return Colors.green;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: selected ? _color.withValues(alpha: 0.1) : Colors.grey.shade100,
          border: Border.all(
            color: selected ? _color : Colors.grey.shade300,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: selected ? _color : Colors.grey.shade400,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  '$rating',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: selected ? _color : Colors.grey.shade800,
                ),
              ),
            ),
            if (selected)
              Icon(
                Icons.check_circle,
                color: _color,
                size: 24,
              ),
          ],
        ),
      ),
    );
  }
}

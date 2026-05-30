import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

class RatingStars extends StatelessWidget {
  const RatingStars({
    required this.rating,
    super.key,
    this.onChanged,
    this.size = 26,
  });

  final int rating;
  final ValueChanged<int>? onChanged;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final value = index + 1;
        final selected = value <= rating;
        return Tooltip(
          message: '$value star',
          child: InkResponse(
            onTap: onChanged == null ? null : () => onChanged!(value),
            radius: size,
            child: SizedBox(
              width: size + 8,
              height: size + 8,
              child: Icon(
                selected ? Icons.star_rounded : Icons.star_border_rounded,
                color: selected ? AppTheme.primary : const Color(0xFFB6C2CF),
                size: size,
              ),
            ),
          ),
        );
      }),
    );
  }
}

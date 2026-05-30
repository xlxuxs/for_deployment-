import 'package:flutter/material.dart';

class StatusPill extends StatelessWidget {
  const StatusPill({required this.status, super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'active' => const Color(0xFF0F8B7B),
      'paused' => const Color(0xFFB7791F),
      'closed' => const Color(0xFF62748A),
      _ => const Color(0xFF62748A),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.isEmpty ? 'unknown' : status,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w800,
          fontSize: 12,
        ),
      ),
    );
  }
}

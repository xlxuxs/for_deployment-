import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../cubit/comment_cubit.dart';
import '../cubit/comment_state.dart';

class ReportCommentDialog extends StatefulWidget {
  const ReportCommentDialog({
    required this.commentId,
    super.key,
  });

  final String commentId;

  @override
  State<ReportCommentDialog> createState() => _ReportCommentDialogState();
}

class _ReportCommentDialogState extends State<ReportCommentDialog> {
  String _selectedReason = 'spam';

  final _reasons = {
    'spam': 'Spam',
    'hate speech': 'Hate Speech',
    'off-topic': 'Off-Topic',
    'other': 'Other',
  };

  void _submitReport() {
    context.read<CommentCubit>().reportComment(
          commentId: widget.commentId,
          reason: _selectedReason,
        );
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<CommentCubit, CommentState>(
      listener: (context, state) {
        if (state is CommentReported) {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(state.message)),
          );
        } else if (state is CommentError) {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red,
            ),
          );
        }
      },
      child: AlertDialog(
        title: const Text('Report Comment'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Why are you reporting this comment?'),
            const SizedBox(height: 8),
            const Text(
              'When a comment receives 3 reports, it will be hidden '
              '(visibility="hidden", moderationStatus="needs_review") '
              'and flagged for moderator review.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            ..._reasons.entries.map(
              (entry) => RadioListTile<String>(
                title: Text(entry.value),
                value: entry.key,
                groupValue: _selectedReason,
                onChanged: (value) {
                  setState(() {
                    _selectedReason = value!;
                  });
                },
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          BlocBuilder<CommentCubit, CommentState>(
            builder: (context, state) {
              final isReporting = state is CommentReporting;

              return ElevatedButton(
                onPressed: isReporting ? null : _submitReport,
                child: isReporting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Report'),
              );
            },
          ),
        ],
      ),
    );
  }
}

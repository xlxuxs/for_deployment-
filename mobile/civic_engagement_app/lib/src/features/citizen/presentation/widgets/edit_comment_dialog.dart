import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../cubit/comment_cubit.dart';
import '../cubit/comment_state.dart';

/// Dialog for editing a comment
class EditCommentDialog extends StatefulWidget {
  const EditCommentDialog({
    required this.commentId,
    required this.currentText,
    required this.policyId,
    super.key,
  });

  final String commentId;
  final String currentText;
  final String policyId;

  @override
  State<EditCommentDialog> createState() => _EditCommentDialogState();
}

class _EditCommentDialogState extends State<EditCommentDialog> {
  late final TextEditingController _textController;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController(text: widget.currentText);
  }

  @override
  void dispose() {
    _textController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocListener<CommentCubit, CommentState>(
      listener: (context, state) {
        if (state is CommentEdited) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.green,
            ),
          );
          // Refresh comments list after successful edit
          context.read<CommentCubit>().loadComments(
                policyId: widget.policyId,
                refresh: true,
              );
        } else if (state is CommentError) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.red,
            ),
          );
        }
      },
      child: AlertDialog(
        title: const Text('Edit Comment'),
        content: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Update your comment text below. Top-level comments will be '
                're-analyzed by AI (moderationStatus set to "pending_ai"). '
                'Replies are not re-analyzed.',
                style: TextStyle(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _textController,
                decoration: const InputDecoration(
                  hintText: 'Enter your updated comment...',
                  border: OutlineInputBorder(),
                  counterText: '',
                ),
                maxLines: 5,
                maxLength: 2000,
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Comment cannot be empty';
                  }
                  if (value.trim().length < 1) {
                    return 'Comment must be at least 1 character';
                  }
                  if (value.trim().length > 2000) {
                    return 'Comment must be 2000 characters or less';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 8),
              Text(
                '${_textController.text.length}/2000 characters',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          BlocBuilder<CommentCubit, CommentState>(
            builder: (context, state) {
              final isEditing = state is CommentEditing;
              return ElevatedButton(
                onPressed: isEditing
                    ? null
                    : () {
                        if (_formKey.currentState!.validate()) {
                          context.read<CommentCubit>().editComment(
                                commentId: widget.commentId,
                                text: _textController.text.trim(),
                              );
                        }
                      },
                child: isEditing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Update'),
              );
            },
          ),
        ],
      ),
    );
  }
}

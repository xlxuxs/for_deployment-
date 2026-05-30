import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/comment.dart';
import '../cubit/comment_cubit.dart';
import '../cubit/comment_state.dart';

/// Dialog for replying to a comment
class ReplyCommentDialog extends StatefulWidget {
  const ReplyCommentDialog({
    required this.policyId,
    required this.parentComment,
    super.key,
  });

  final String policyId;
  final Comment parentComment;

  @override
  State<ReplyCommentDialog> createState() => _ReplyCommentDialogState();
}

class _ReplyCommentDialogState extends State<ReplyCommentDialog> {
  late final TextEditingController _textController;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _textController = TextEditingController();
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
        if (state is CommentPosted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(state.message),
              backgroundColor: Colors.green,
            ),
          );
          // Refresh replies for the parent comment
          context.read<CommentCubit>().loadReplies(widget.parentComment.id);
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
        title: const Text('Reply to Comment'),
        content: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Show parent comment context
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: Colors.grey.withValues(alpha: 0.3),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.person, size: 16, color: Colors.grey),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              widget.parentComment.userEmail ?? 'Anonymous',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        widget.parentComment.text,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Colors.grey,
                        ),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Your reply will be immediately approved and the author will be notified.',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _textController,
                  decoration: const InputDecoration(
                    hintText: 'Write your reply...',
                    border: OutlineInputBorder(),
                    counterText: '',
                  ),
                  maxLines: 5,
                  maxLength: 2000,
                  autofocus: true,
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Reply cannot be empty';
                    }
                    if (value.trim().length < 1) {
                      return 'Reply must be at least 1 character';
                    }
                    if (value.trim().length > 2000) {
                      return 'Reply must be 2000 characters or less';
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
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          BlocBuilder<CommentCubit, CommentState>(
            builder: (context, state) {
              final isPosting = state is CommentPosting;
              return ElevatedButton.icon(
                onPressed: isPosting
                    ? null
                    : () {
                        if (_formKey.currentState!.validate()) {
                          context.read<CommentCubit>().postComment(
                                policyId: widget.policyId,
                                text: _textController.text.trim(),
                                parentCommentId: widget.parentComment.id,
                              );
                        }
                      },
                icon: isPosting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send, size: 18),
                label: Text(isPosting ? 'Posting...' : 'Post Reply'),
              );
            },
          ),
        ],
      ),
    );
  }
}

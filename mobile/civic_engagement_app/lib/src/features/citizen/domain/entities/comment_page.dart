import 'comment.dart';

class CommentPage {
  const CommentPage({
    required this.comments,
    required this.total,
    required this.page,
  });

  final List<Comment> comments;
  final int total;
  final int page;
}

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/comment.dart';
import '../../domain/entities/user_interaction.dart';
import '../../domain/repositories/citizen_repository.dart';
import 'comment_state.dart';

/// Represents a comment with its loaded replies
class CommentWithReplies {
  const CommentWithReplies({
    required this.comment,
    this.replies = const [],
    this.repliesLoaded = false,
    this.repliesLoading = false,
    this.hasMoreReplies = false,
  });

  final Comment comment;
  final List<Comment> replies;
  final bool repliesLoaded;
  final bool repliesLoading;
  final bool hasMoreReplies;

  CommentWithReplies copyWith({
    Comment? comment,
    List<Comment>? replies,
    bool? repliesLoaded,
    bool? repliesLoading,
    bool? hasMoreReplies,
  }) {
    return CommentWithReplies(
      comment: comment ?? this.comment,
      replies: replies ?? this.replies,
      repliesLoaded: repliesLoaded ?? this.repliesLoaded,
      repliesLoading: repliesLoading ?? this.repliesLoading,
      hasMoreReplies: hasMoreReplies ?? this.hasMoreReplies,
    );
  }
}

class CommentCubit extends Cubit<CommentState> {
  CommentCubit(this._repository) : super(const CommentInitial());

  final CitizenRepository _repository;
  List<CommentWithReplies> _allComments = [];
  int _currentPage = 1;
  int _total = 0;
  final Map<String, String> _translatedComments = {};

  Future<void> loadComments({
    required String policyId,
    bool refresh = false,
  }) async {
    if (refresh) {
      _currentPage = 1;
      _allComments = [];
      _total = 0;
    }

    emit(const CommentLoading());

    try {
      final page = await _repository.getPolicyComments(
        policyId: policyId,
        page: _currentPage,
      );

      final commentsWithReplies = page.comments
          .map((comment) => CommentWithReplies(comment: comment))
          .toList();

      if (refresh) {
        _allComments = commentsWithReplies;
      } else {
        _allComments.addAll(commentsWithReplies);
      }

      _total = page.total;
      _currentPage = page.page;

      emit(
        CommentLoaded(
          comments: _allComments.map((c) => c.comment).toList(),
          total: _total,
          page: _currentPage,
          hasMore: _allComments.length < _total,
          translatedComments: Map.unmodifiable(_translatedComments),
        ),
      );
    } catch (e) {
      emit(CommentError(e.toString()));
    }
  }

  Future<void> loadMore({
    required String policyId,
  }) async {
    if (_allComments.length >= _total) return;

    try {
      final page = await _repository.getPolicyComments(
        policyId: policyId,
        page: _currentPage + 1,
      );

      final commentsWithReplies = page.comments
          .map((comment) => CommentWithReplies(comment: comment))
          .toList();

      _allComments.addAll(commentsWithReplies);
      _currentPage = page.page;

      emit(
        CommentLoaded(
          comments: _allComments.map((c) => c.comment).toList(),
          total: _total,
          page: _currentPage,
          hasMore: _allComments.length < _total,
          translatedComments: Map.unmodifiable(_translatedComments),
        ),
      );
    } catch (e) {
      emit(CommentError(e.toString()));
    }
  }

  Future<void> loadReplies(String commentId) async {
    final commentIndex =
        _allComments.indexWhere((c) => c.comment.id == commentId);
    if (commentIndex == -1) return;

    final commentWithReplies = _allComments[commentIndex];
    if (commentWithReplies.repliesLoaded || commentWithReplies.repliesLoading) {
      return;
    }

    // Update loading state
    _allComments[commentIndex] =
        commentWithReplies.copyWith(repliesLoading: true);
    _emitCurrentState();

    try {
      final repliesPage =
          await _repository.getCommentReplies(commentId: commentId);

      _allComments[commentIndex] = commentWithReplies.copyWith(
        replies: repliesPage.comments,
        repliesLoaded: true,
        repliesLoading: false,
        hasMoreReplies: repliesPage.hasMore,
      );

      _emitCurrentState();
    } catch (e) {
      _allComments[commentIndex] =
          commentWithReplies.copyWith(repliesLoading: false);
      _emitCurrentState();
      emit(CommentError(e.toString()));
    }
  }

  List<Comment> getReplies(String commentId) {
    final commentWithReplies = _allComments.firstWhere(
      (c) => c.comment.id == commentId,
      orElse: () => CommentWithReplies(
        comment: Comment(
          id: '',
          policyId: '',
          text: '',
          visibility: '',
          moderationStatus: '',
          createdAt: DateTime.fromMillisecondsSinceEpoch(0),
        ),
      ),
    );
    return commentWithReplies.replies;
  }

  bool areRepliesLoaded(String commentId) {
    final commentWithReplies = _allComments.firstWhere(
      (c) => c.comment.id == commentId,
      orElse: () => CommentWithReplies(
        comment: Comment(
          id: '',
          policyId: '',
          text: '',
          visibility: '',
          moderationStatus: '',
          createdAt: DateTime.fromMillisecondsSinceEpoch(0),
        ),
      ),
    );
    return commentWithReplies.repliesLoaded;
  }

  bool areRepliesLoading(String commentId) {
    final commentWithReplies = _allComments.firstWhere(
      (c) => c.comment.id == commentId,
      orElse: () => CommentWithReplies(
        comment: Comment(
          id: '',
          policyId: '',
          text: '',
          visibility: '',
          moderationStatus: '',
          createdAt: DateTime.fromMillisecondsSinceEpoch(0),
        ),
      ),
    );
    return commentWithReplies.repliesLoading;
  }

  void _emitCurrentState() {
    emit(_currentLoadedState());
  }

  CommentLoaded _currentLoadedState() {
    return CommentLoaded(
      comments: _allComments.map((c) => c.comment).toList(),
      total: _total,
      page: _currentPage,
      hasMore: _allComments.length < _total,
      translatedComments: Map.unmodifiable(_translatedComments),
    );
  }

  Future<void> postComment({
    required String policyId,
    required String text,
    String? parentCommentId,
  }) async {
    emit(
      CommentPosting(
        comments: _currentLoadedState().comments,
        total: _total,
        page: _currentPage,
        hasMore: _allComments.length < _total,
      ),
    );

    try {
      final message = await _repository.postComment(
        policyId: policyId,
        text: text,
        parentCommentId: parentCommentId,
      );

      // Record comment interaction for personalized feed (only for top-level comments)
      if (parentCommentId == null) {
        try {
          await _repository.recordInteraction(
            UserInteraction(
              policyId: policyId,
              type: InteractionType.comment,
            ),
          );
        } catch (_) {
          // Silently fail - don't block comment success
        }
      }

      emit(CommentPosted(message));
    } catch (e) {
      emit(CommentError(e.toString()));
    }
  }

  Future<void> reportComment({
    required String commentId,
    required String reason,
  }) async {
    emit(
      CommentReporting(
        comments: _currentLoadedState().comments,
        total: _total,
        page: _currentPage,
        hasMore: _allComments.length < _total,
      ),
    );

    try {
      final message = await _repository.reportComment(
        commentId: commentId,
        reason: reason,
      );
      emit(CommentReported(message));
    } catch (e) {
      emit(CommentError(e.toString()));
    }
  }

  Future<void> editComment({
    required String commentId,
    required String text,
  }) async {
    emit(
      CommentEditing(
        comments: _currentLoadedState().comments,
        total: _total,
        page: _currentPage,
        hasMore: _allComments.length < _total,
      ),
    );

    try {
      final message = await _repository.editComment(
        commentId: commentId,
        text: text,
      );
      emit(CommentEdited(message));
    } catch (e) {
      emit(CommentError(e.toString()));
    }
  }

  Future<void> appealComment({
    required String commentId,
    required String reason,
    String? policyId,
  }) async {
    emit(
      CommentAppealing(
        comments: _currentLoadedState().comments,
        total: _total,
        page: _currentPage,
        hasMore: _allComments.length < _total,
        translatedComments: Map.unmodifiable(_translatedComments),
      ),
    );

    try {
      final message = await _repository.appealComment(
        commentId: commentId,
        reason: reason,
      );
      emit(
        CommentAppealed(
          message: message,
          comments: _currentLoadedState().comments,
          total: _total,
          page: _currentPage,
          hasMore: _allComments.length < _total,
          translatedComments: Map.unmodifiable(_translatedComments),
        ),
      );
      if (policyId != null) {
        await loadComments(policyId: policyId, refresh: true);
      }
    } catch (e) {
      emit(CommentError(e.toString()));
    }
  }

  Future<String> translateText({
    required String text,
    required String targetLang,
  }) {
    return _repository.translateText(text: text, targetLang: targetLang);
  }
}

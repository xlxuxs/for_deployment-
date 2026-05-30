import 'package:equatable/equatable.dart';

/// Represents a comment on a policy
class Comment extends Equatable {
  const Comment({
    required this.id,
    required this.policyId,
    required this.text,
    required this.visibility,
    required this.moderationStatus,
    required this.createdAt,
    this.parentCommentId,
    this.userId,
    this.userEmail,
    this.hiddenReason,
    this.moderationReason,
    this.sentiment,
    this.keywords,
    this.isOfficialReply = false,
    this.isEdited = false,
    this.reportCount = 0,
    this.appeal,
    this.flaggedSnapshot,
  });

  final String id;
  final String policyId;
  final String? parentCommentId;
  final String text;
  final String? userId;
  final String? userEmail;
  final String visibility; // "visible" or "hidden"
  final String? hiddenReason; // null, "profanity", "reports", "moderator"
  final String moderationStatus; // "pending_ai", "needs_review", "reviewed", "none"
  final String? moderationReason; // "pending_ai", "low_confidence", "reports", "moderator_flag"
  final CommentSentiment? sentiment;
  final List<String>? keywords;
  final bool isOfficialReply;
  final bool isEdited;
  final int reportCount;
  final CommentAppeal? appeal;
  final FlaggedSnapshot? flaggedSnapshot;
  final DateTime createdAt;

  bool get isVisible => visibility == 'visible';
  bool get isHidden => visibility == 'hidden';
  bool get isPendingAI => moderationStatus == 'pending_ai';
  bool get needsReview => moderationStatus == 'needs_review';
  bool get isReviewed => moderationStatus == 'reviewed';
  bool get canAppeal => isHidden && needsReview;
  bool get hasAppeal => appeal != null;

  @override
  List<Object?> get props => [
        id,
        policyId,
        parentCommentId,
        text,
        userId,
        userEmail,
        visibility,
        hiddenReason,
        moderationStatus,
        moderationReason,
        sentiment,
        keywords,
        isOfficialReply,
        isEdited,
        reportCount,
        appeal,
        flaggedSnapshot,
        createdAt,
      ];
}

/// Immutable snapshot taken when a comment is flagged (reportCount >= 3)
class FlaggedSnapshot extends Equatable {
  const FlaggedSnapshot({
    required this.text,
    required this.timestamp,
    required this.reportCountAtCapture,
    this.sentiment,
    this.keywords,
  });

  final String text;
  final DateTime timestamp;
  final int reportCountAtCapture;
  final CommentSentiment? sentiment;
  final List<String>? keywords;

  @override
  List<Object?> get props => [
        text,
        timestamp,
        reportCountAtCapture,
        sentiment,
        keywords,
      ];
}

/// Sentiment analysis result for a comment
class CommentSentiment extends Equatable {
  const CommentSentiment({
    required this.label,
    required this.confidence,
  });

  final String label; // positive, negative, neutral
  final double confidence;

  @override
  List<Object?> get props => [label, confidence];
}

/// Appeal information for a moderated comment
class CommentAppeal extends Equatable {
  const CommentAppeal({
    required this.reason,
    required this.status,
    required this.submittedAt,
    this.resolvedAt,
    this.resolution,
    this.note,
  });

  final String reason;
  final String status; // pending, resolved_approved, resolved_rejected
  final DateTime submittedAt;
  final DateTime? resolvedAt;
  final String? resolution; // approve, reject
  final String? note;

  bool get isPending => status == 'pending';
  bool get isResolved => status.startsWith('resolved_');
  bool get wasApproved => status == 'resolved_approved';

  @override
  List<Object?> get props => [
        reason,
        status,
        submittedAt,
        resolvedAt,
        resolution,
        note,
      ];
}

/// Page of comments with pagination info
class CommentPage extends Equatable {
  const CommentPage({
    required this.comments,
    required this.total,
    required this.page,
  });

  final List<Comment> comments;
  final int total;
  final int page;

  bool get hasMore => comments.length < total;

  @override
  List<Object?> get props => [comments, total, page];
}

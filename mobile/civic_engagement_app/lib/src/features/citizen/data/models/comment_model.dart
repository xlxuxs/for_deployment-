import '../../domain/entities/comment.dart';

class CommentModel extends Comment {
  const CommentModel({
    required super.id,
    required super.policyId,
    required super.text,
    required super.visibility,
    required super.moderationStatus,
    required super.createdAt,
    super.parentCommentId,
    super.userId,
    super.userEmail,
    super.hiddenReason,
    super.moderationReason,
    super.sentiment,
    super.keywords,
    super.isOfficialReply,
    super.isEdited,
    super.reportCount,
    super.appeal,
    super.flaggedSnapshot,
  });

  factory CommentModel.fromJson(Map<String, dynamic> json) {
    return CommentModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      policyId: json['policyId']?.toString() ?? '',
      parentCommentId: json['parentCommentId']?.toString(),
      text: json['text']?.toString() ?? '',
      userId: _parseId(json['userId']),
      userEmail: json['userEmail']?.toString(),
      visibility: json['visibility']?.toString() ?? 'visible',
      hiddenReason: json['hiddenReason']?.toString(),
      moderationStatus: json['moderationStatus']?.toString() ?? 'none',
      moderationReason: json['moderationReason']?.toString(),
      sentiment: _parseSentiment(json['sentiment']),
      keywords: _parseKeywords(json['keywords']),
      isOfficialReply: json['isOfficialReply'] == true,
      isEdited: json['isEdited'] == true,
      reportCount: _toInt(json['reportCount']),
      appeal: _parseAppeal(json['appeal']),
      flaggedSnapshot: _parseFlaggedSnapshot(json['flaggedSnapshot']),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.now(),
    );
  }

  static CommentSentiment? _parseSentiment(dynamic value) {
    if (value is String) {
      final label = value.trim().toLowerCase();
      if (label == 'positive' || label == 'negative' || label == 'neutral') {
        return CommentSentiment(label: label, confidence: 0);
      }
      return null;
    }
    if (value is! Map<String, dynamic>) return null;
    return CommentSentiment(
      label: value['label']?.toString() ?? 'neutral',
      confidence: _toDouble(value['confidence']),
    );
  }

  static List<String>? _parseKeywords(dynamic value) {
    if (value is! List) return null;
    return value.map((e) => e.toString()).toList();
  }

  static CommentAppeal? _parseAppeal(dynamic value) {
    if (value is! Map<String, dynamic>) return null;
    return CommentAppeal(
      reason: value['reason']?.toString() ?? '',
      status: value['status']?.toString() ?? 'pending',
      submittedAt: DateTime.tryParse(
            (value['submittedAt'] ?? value['createdAt'])?.toString() ?? '',
          ) ??
          DateTime.now(),
      resolvedAt: DateTime.tryParse(value['resolvedAt']?.toString() ?? ''),
      resolution: value['resolution']?.toString(),
      note: value['note']?.toString() ?? value['resolutionNote']?.toString(),
    );
  }

  static double _toDouble(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0.0;
  }

  static int _toInt(dynamic value) {
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static FlaggedSnapshot? _parseFlaggedSnapshot(dynamic value) {
    if (value is! Map<String, dynamic>) return null;
    return FlaggedSnapshot(
      text: value['text']?.toString() ?? '',
      timestamp: DateTime.tryParse(
            (value['timestamp'] ?? value['capturedAt'])?.toString() ?? '',
          ) ??
          DateTime.now(),
      reportCountAtCapture: _toInt(value['reportCountAtCapture']),
      sentiment: _parseSentiment(value['sentiment']),
      keywords: _parseKeywords(value['keywords']),
    );
  }

  static String? _parseId(dynamic value) {
    if (value == null) return null;
    if (value is Map<String, dynamic>) {
      return (value['_id'] ?? value['id'])?.toString();
    }
    return value.toString();
  }
}

import '../../domain/entities/vote_history.dart';

class VoteHistoryModel extends VoteHistory {
  const VoteHistoryModel({
    required super.id,
    required super.value,
    required super.channel,
    super.policyId,
    super.policyTitle,
    super.policyCode,
    super.pollType,
    super.comment,
    super.sentiment,
    super.createdAt,
  });

  factory VoteHistoryModel.fromJson(Map<String, dynamic> json) {
    final policy = json['policy'];
    final policyMap = policy is Map<String, dynamic> ? policy : null;
    return VoteHistoryModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      policyId: policyMap?['id']?.toString() ?? policyMap?['_id']?.toString(),
      policyTitle: policyMap?['title']?.toString(),
      policyCode: policyMap?['policyCode']?.toString(),
      pollType:
          policyMap?['pollType']?.toString() ?? json['pollType']?.toString(),
      value: json['value'] ?? json['rating'], // Support both old and new format
      comment: _parseComment(json['comment']),
      channel: json['channel']?.toString() ?? 'app',
      sentiment: _parseSentiment(json['sentiment']),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  static String? _parseComment(dynamic value) {
    if (value == null) return null;
    if (value is String) return value;
    if (value is Map<String, dynamic>) {
      return value['text']?.toString() ?? value['comment']?.toString();
    }
    return value.toString();
  }

  static String? _parseSentiment(dynamic value) {
    if (value == null) return null;
    if (value is String) return _normalizeSentiment(value);
    if (value is Map<String, dynamic>) {
      return _normalizeSentiment(value['label']?.toString());
    }
    return _normalizeSentiment(value.toString());
  }

  static String? _normalizeSentiment(String? value) {
    final normalized = value?.trim().toLowerCase();
    if (normalized == 'positive' ||
        normalized == 'negative' ||
        normalized == 'neutral') {
      return normalized;
    }
    return null;
  }
}

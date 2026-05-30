import '../../domain/entities/feed_policy.dart';

class FeedPolicyModel extends FeedPolicy {
  const FeedPolicyModel({
    required super.id,
    required super.title,
    required super.description,
    required super.policyCode,
    required super.pollType,
    required super.startDate,
    required super.endDate,
    required super.targetRegions,
    required super.relevanceScore,
  });

  factory FeedPolicyModel.fromJson(Map<String, dynamic> json) {
    return FeedPolicyModel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      policyCode: json['policyCode'] as String,
      pollType: json['pollType'] as String,
      startDate: DateTime.parse(json['startDate'] as String),
      endDate: DateTime.parse(json['endDate'] as String),
      targetRegions: (json['targetRegions'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      relevanceScore: double.parse(json['relevanceScore'].toString()),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'policyCode': policyCode,
        'pollType': pollType,
        'startDate': startDate.toIso8601String(),
        'endDate': endDate.toIso8601String(),
        'targetRegions': targetRegions,
        'relevanceScore': relevanceScore.toString(),
      };
}

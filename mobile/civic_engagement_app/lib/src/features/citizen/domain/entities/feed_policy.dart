import 'package:equatable/equatable.dart';

/// Represents a policy in the personalized feed with relevance scoring
class FeedPolicy extends Equatable {
  final String id;
  final String title;
  final String description;
  final String policyCode;
  final String pollType;
  final DateTime startDate;
  final DateTime endDate;
  final List<String> targetRegions;
  final double relevanceScore;

  const FeedPolicy({
    required this.id,
    required this.title,
    required this.description,
    required this.policyCode,
    required this.pollType,
    required this.startDate,
    required this.endDate,
    required this.targetRegions,
    required this.relevanceScore,
  });

  @override
  List<Object?> get props => [
        id,
        title,
        description,
        policyCode,
        pollType,
        startDate,
        endDate,
        targetRegions,
        relevanceScore,
      ];
}

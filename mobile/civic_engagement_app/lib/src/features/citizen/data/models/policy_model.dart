import '../../domain/entities/policy.dart';

class PolicyModel extends Policy {
  const PolicyModel({
    required super.id,
    required super.title,
    required super.description,
    required super.policyCode,
    required super.targetRegions,
    required super.status,
    required super.pollType,
    super.averageRating,
    super.totalVotes = 0,
    super.startDate,
    super.endDate,
    super.createdBy,
    super.createdAt,
    super.pollOptions,
    super.maxSelections,
    super.likertLabels,
    super.rankedChoiceMaxRank,
    super.relevanceFactors,
    super.citizenAnalyticsVisibility,
    super.topics,
    super.yesCount,
    super.noCount,
    super.yesPercentage,
    super.noPercentage,
    super.approveCount,
    super.rejectCount,
    super.abstainCount,
  });

  factory PolicyModel.fromJson(Map<String, dynamic> json) {
    return PolicyModel(
      id: (json['id'] ?? json['_id'] ?? '').toString(),
      title: json['title']?.toString() ?? 'Untitled policy',
      description: json['description']?.toString() ?? '',
      policyCode: json['policyCode']?.toString() ?? '',
      targetRegions: _strings(json['targetRegions']),
      startDate: DateTime.tryParse(json['startDate']?.toString() ?? ''),
      endDate: DateTime.tryParse(json['endDate']?.toString() ?? ''),
      status: json['status']?.toString() ?? '',
      pollType: json['pollType']?.toString() ?? 'rating',
      averageRating: _toDoubleOrNull(json['averageRating']),
      totalVotes: _toInt(json['totalVotes']),
      createdBy: json['createdBy']?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
      pollOptions: _parsePollOptions(json['pollOptions']),
      maxSelections: _toIntOrNull(json['maxSelections']),
      likertLabels: _strings(json['likertLabels']),
      rankedChoiceMaxRank: _toIntOrNull(json['rankedChoiceMaxRank']),
      relevanceFactors: _parseRelevanceFactors(json['relevanceFactors']),
      citizenAnalyticsVisibility: _parseAnalyticsVisibility(
        json['citizenAnalyticsVisibility'],
      ),
      topics: _strings(json['topics']),
      yesCount: _toIntOrNull(json['yesCount']),
      noCount: _toIntOrNull(json['noCount']),
      yesPercentage: json['yesPercentage']?.toString(),
      noPercentage: json['noPercentage']?.toString(),
      approveCount: _toIntOrNull(json['approveCount']),
      rejectCount: _toIntOrNull(json['rejectCount']),
      abstainCount: _toIntOrNull(json['abstainCount']),
    );
  }

  static List<String> _strings(dynamic value) {
    if (value is List) {
      return value.map((item) => item.toString()).toList();
    }
    return const [];
  }

  static List<PollOption>? _parsePollOptions(dynamic value) {
    if (value is! List) return null;
    return value
        .whereType<Map<String, dynamic>>()
        .map(
          (json) => PollOption(
            id: json['id']?.toString() ?? '',
            text: json['text']?.toString() ?? '',
            shortCode: json['shortCode']?.toString() ?? '',
          ),
        )
        .toList();
  }

  static RelevanceFactors? _parseRelevanceFactors(dynamic value) {
    if (value is! Map<String, dynamic>) return null;
    return RelevanceFactors(
      women: value['women'] == true,
      youth: value['youth'] == true,
      farmers: value['farmers'] == true,
      urban: value['urban'] == true,
      rural: value['rural'] == true,
      privateSector: value['privateSector'] == true,
      government: value['government'] == true,
    );
  }

  static CitizenAnalyticsVisibility? _parseAnalyticsVisibility(dynamic value) {
    if (value is! Map<String, dynamic>) return null;
    return CitizenAnalyticsVisibility(
      showResults: value['showResults'] == true,
      showBreakdown: value['showBreakdown'] == true,
      showComments: value['showComments'] == true,
      showSentiment: value['showSentiment'] == true,
      allowTimeFilter: value['allowTimeFilter'] == true,
    );
  }

  static double? _toDoubleOrNull(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '');
  }

  static int _toInt(dynamic value) {
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static int? _toIntOrNull(dynamic value) {
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '');
  }
}

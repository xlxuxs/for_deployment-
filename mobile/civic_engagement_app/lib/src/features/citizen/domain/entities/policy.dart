import 'package:equatable/equatable.dart';

class Policy extends Equatable {
  const Policy({
    required this.id,
    required this.title,
    required this.description,
    required this.policyCode,
    required this.targetRegions,
    required this.status,
    required this.pollType,
    this.averageRating,
    this.totalVotes = 0,
    this.startDate,
    this.endDate,
    this.createdBy,
    this.createdAt,
    this.pollOptions,
    this.maxSelections,
    this.likertLabels,
    this.rankedChoiceMaxRank,
    this.relevanceFactors,
    this.citizenAnalyticsVisibility,
    this.topics,
    this.yesCount,
    this.noCount,
    this.yesPercentage,
    this.noPercentage,
    this.approveCount,
    this.rejectCount,
    this.abstainCount,
  });

  final String id;
  final String title;
  final String description;
  final String policyCode;
  final List<String> targetRegions;
  final DateTime? startDate;
  final DateTime? endDate;
  final String status;
  final String pollType; // binary, multipleChoice, likert, approval, rating, rankedChoice
  final double? averageRating;
  final int totalVotes;
  final String? createdBy;
  final DateTime? createdAt;
  
  // Poll configuration
  final List<PollOption>? pollOptions;
  final int? maxSelections;
  final List<String>? likertLabels;
  final int? rankedChoiceMaxRank;
  
  // Relevance and visibility
  final RelevanceFactors? relevanceFactors;
  final CitizenAnalyticsVisibility? citizenAnalyticsVisibility;
  final List<String>? topics;
  
  // Binary poll results
  final int? yesCount;
  final int? noCount;
  final String? yesPercentage;
  final String? noPercentage;
  
  // Approval poll results
  final int? approveCount;
  final int? rejectCount;
  final int? abstainCount;

  bool get canVote => status == 'active';
  bool get isPaused => status == 'paused';
  bool get isClosed => status == 'closed';
  bool get isArchived => status == 'archived';
  
  bool get isBinary => pollType == 'binary';
  bool get isMultipleChoice => pollType == 'multipleChoice';
  bool get isLikert => pollType == 'likert';
  bool get isApproval => pollType == 'approval';
  bool get isRating => pollType == 'rating';
  bool get isRankedChoice => pollType == 'rankedChoice';

  @override
  List<Object?> get props => [
    id,
    title,
    description,
    policyCode,
    targetRegions,
    startDate,
    endDate,
    status,
    pollType,
    averageRating,
    totalVotes,
    createdBy,
    createdAt,
    pollOptions,
    maxSelections,
    likertLabels,
    rankedChoiceMaxRank,
    relevanceFactors,
    citizenAnalyticsVisibility,
    topics,
    yesCount,
    noCount,
    yesPercentage,
    noPercentage,
    approveCount,
    rejectCount,
    abstainCount,
  ];
}

class PollOption extends Equatable {
  const PollOption({
    required this.id,
    required this.text,
    required this.shortCode,
  });

  final String id;
  final String text;
  final String shortCode;

  @override
  List<Object?> get props => [id, text, shortCode];
}

class RelevanceFactors extends Equatable {
  const RelevanceFactors({
    this.women = false,
    this.youth = false,
    this.farmers = false,
    this.urban = false,
    this.rural = false,
    this.privateSector = false,
    this.government = false,
  });

  final bool women;
  final bool youth;
  final bool farmers;
  final bool urban;
  final bool rural;
  final bool privateSector;
  final bool government;

  @override
  List<Object?> get props => [
    women,
    youth,
    farmers,
    urban,
    rural,
    privateSector,
    government,
  ];
}

class CitizenAnalyticsVisibility extends Equatable {
  const CitizenAnalyticsVisibility({
    this.showResults = true,
    this.showBreakdown = false,
    this.showComments = false,
    this.showSentiment = false,
    this.allowTimeFilter = false,
  });

  final bool showResults;
  final bool showBreakdown;
  final bool showComments;
  final bool showSentiment;
  final bool allowTimeFilter;

  @override
  List<Object?> get props => [
    showResults,
    showBreakdown,
    showComments,
    showSentiment,
    allowTimeFilter,
  ];
}

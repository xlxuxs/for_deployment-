import 'package:equatable/equatable.dart';

class VoteHistory extends Equatable {
  const VoteHistory({
    required this.id,
    required this.value,
    required this.channel,
    this.policyId,
    this.policyTitle,
    this.policyCode,
    this.pollType,
    this.comment,
    this.sentiment,
    this.createdAt,
  });

  final String id;
  final String? policyId;
  final String? policyTitle;
  final String? policyCode;
  final String? pollType; // Type of poll: binary, multipleChoice, likert, approval, rating, rankedChoice
  final dynamic value; // Can be int, String, or List<String> based on poll type
  final String? comment;
  final String channel;
  final String? sentiment;
  final DateTime? createdAt;

  bool get hasComment => comment != null && comment!.trim().isNotEmpty;

  @override
  List<Object?> get props => [
    id,
    policyId,
    policyTitle,
    policyCode,
    pollType,
    value,
    comment,
    channel,
    sentiment,
    createdAt,
  ];
}

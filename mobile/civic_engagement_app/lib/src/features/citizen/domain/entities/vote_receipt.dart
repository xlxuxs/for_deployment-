import 'package:equatable/equatable.dart';

class VoteReceipt extends Equatable {
  const VoteReceipt({
    required this.voteId,
    required this.value,
    required this.message,
    this.commentId,
  });

  final String voteId;
  final String? commentId;
  final dynamic value; // Can be int, String, List<String> depending on poll type
  final String message;

  @override
  List<Object?> get props => [voteId, commentId, value, message];
}

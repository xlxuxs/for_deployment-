part of 'vote_cubit.dart';

class VoteState extends Equatable {
  const VoteState({
    this.status = RequestStatus.initial,
    this.receipt,
    this.message,
    this.alreadyVoted = false,
  });

  final RequestStatus status;
  final VoteReceipt? receipt;
  final String? message;
  final bool alreadyVoted;

  @override
  List<Object?> get props => [status, receipt, message, alreadyVoted];
}

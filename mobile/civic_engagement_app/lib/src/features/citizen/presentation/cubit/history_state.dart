part of 'history_cubit.dart';

class HistoryState extends Equatable {
  const HistoryState({
    this.status = RequestStatus.initial,
    this.history = const [],
    this.message,
  });

  final RequestStatus status;
  final List<VoteHistory> history;
  final String? message;

  HistoryState copyWith({
    RequestStatus? status,
    List<VoteHistory>? history,
    String? message,
  }) {
    return HistoryState(
      status: status ?? this.status,
      history: history ?? this.history,
      message: message,
    );
  }

  @override
  List<Object?> get props => [status, history, message];
}

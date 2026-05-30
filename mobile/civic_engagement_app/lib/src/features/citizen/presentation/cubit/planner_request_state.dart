import 'package:equatable/equatable.dart';

abstract class PlannerRequestState extends Equatable {
  const PlannerRequestState();

  @override
  List<Object?> get props => [];
}

class PlannerRequestInitial extends PlannerRequestState {
  const PlannerRequestInitial();
}

class PlannerRequestLoading extends PlannerRequestState {
  const PlannerRequestLoading();
}

class PlannerRequestSuccess extends PlannerRequestState {
  const PlannerRequestSuccess({
    required this.requestId,
    required this.message,
  });

  final String requestId;
  final String message;

  @override
  List<Object?> get props => [requestId, message];
}

class PlannerRequestError extends PlannerRequestState {
  const PlannerRequestError({
    required this.message,
    this.code,
  });

  final String message;
  final String? code;

  @override
  List<Object?> get props => [message, code];
}

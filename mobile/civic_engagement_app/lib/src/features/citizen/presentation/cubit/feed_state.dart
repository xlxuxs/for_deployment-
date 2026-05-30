import 'package:equatable/equatable.dart';
import '../../domain/entities/feed_policy.dart';

abstract class FeedState extends Equatable {
  const FeedState();

  @override
  List<Object?> get props => [];
}

class FeedInitial extends FeedState {
  const FeedInitial();
}

class FeedLoading extends FeedState {
  const FeedLoading();
}

class FeedLoaded extends FeedState {
  final List<FeedPolicy> policies;
  final DateTime loadedAt;

  const FeedLoaded({
    required this.policies,
    required this.loadedAt,
  });

  @override
  List<Object?> get props => [policies, loadedAt];
}

class FeedError extends FeedState {
  final String message;

  const FeedError(this.message);

  @override
  List<Object?> get props => [message];
}

class FeedInteractionRecording extends FeedState {
  const FeedInteractionRecording();
}

class FeedInteractionRecorded extends FeedState {
  const FeedInteractionRecorded();
}

class FeedInteractionError extends FeedState {
  final String message;

  const FeedInteractionError(this.message);

  @override
  List<Object?> get props => [message];
}

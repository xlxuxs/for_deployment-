import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/user_interaction.dart';
import '../../domain/repositories/citizen_repository.dart';
import 'feed_state.dart';

class FeedCubit extends Cubit<FeedState> {
  FeedCubit(this._repository) : super(const FeedInitial());

  final CitizenRepository _repository;

  Future<void> loadFeed() async {
    emit(const FeedLoading());
    try {
      final policies = await _repository.getPersonalizedFeed();
      emit(FeedLoaded(
        policies: policies,
        loadedAt: DateTime.now(),
      ));
    } catch (e) {
      emit(FeedError(e.toString()));
    }
  }

  Future<void> recordInteraction({
    required String policyId,
    required InteractionType type,
  }) async {
    try {
      final interaction = UserInteraction(
        policyId: policyId,
        type: type,
      );
      
      await _repository.recordInteraction(interaction);
      
      // Reload feed after interaction to get updated relevance scores
      await loadFeed();
    } catch (e) {
      emit(FeedInteractionError(e.toString()));
      // Restore previous state if available
      if (state is FeedLoaded) {
        emit(state);
      }
    }
  }

  void refresh() {
    loadFeed();
  }
}

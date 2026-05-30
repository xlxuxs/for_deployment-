import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/api_exception.dart';
import '../../../../core/state/request_status.dart';
import '../../domain/entities/vote_receipt.dart';
import '../../domain/entities/user_interaction.dart';
import '../../domain/repositories/citizen_repository.dart';

part 'vote_state.dart';

class VoteCubit extends Cubit<VoteState> {
  VoteCubit(this._repository) : super(const VoteState());

  final CitizenRepository _repository;

  Future<void> submitVote({
    required String policyId,
    required dynamic value,
    String? comment,
  }) async {
    emit(const VoteState(status: RequestStatus.loading));
    try {
      final receipt = await _repository.submitVote(
        policyId: policyId,
        value: value,
        comment: comment,
      );

      // Record vote interaction for personalized feed
      try {
        await _repository.recordInteraction(
          UserInteraction(
            policyId: policyId,
            type: InteractionType.vote,
          ),
        );
      } catch (_) {
        // Silently fail - don't block vote success
      }

      emit(
        VoteState(
          status: RequestStatus.success,
          receipt: receipt,
          message: receipt.message,
        ),
      );
    } on ApiException catch (error) {
      if (error.code == 'ALREADY_VOTED' || error.statusCode == 409) {
        emit(
          VoteState(
            status: RequestStatus.success,
            message: error.message,
            alreadyVoted: true,
          ),
        );
        return;
      }
      emit(
        VoteState(
          status: RequestStatus.failure,
          message: error.message,
        ),
      );
    } catch (error) {
      emit(
        const VoteState(
          status: RequestStatus.failure,
          message:
              'An unexpected error occurred. Please check your connection and try again.',
        ),
      );
    }
  }

  Future<void> addComment({
    required String policyId,
    required String comment,
  }) async {
    emit(const VoteState(status: RequestStatus.loading));
    try {
      final message = await _repository.addComment(
        policyId: policyId,
        comment: comment,
      );
      emit(VoteState(status: RequestStatus.success, message: message));
    } on ApiException catch (error) {
      emit(VoteState(status: RequestStatus.failure, message: error.message));
    }
  }
}

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/api_exception.dart';
import '../../../../core/state/request_status.dart';
import '../../domain/entities/vote_history.dart';
import '../../domain/repositories/citizen_repository.dart';

part 'history_state.dart';

class HistoryCubit extends Cubit<HistoryState> {
  HistoryCubit(this._repository) : super(const HistoryState());

  final CitizenRepository _repository;

  Future<void> loadHistory() async {
    emit(state.copyWith(status: RequestStatus.loading));
    try {
      final history = await _repository.getHistory();
      emit(state.copyWith(status: RequestStatus.success, history: history));
    } on ApiException catch (error) {
      emit(
        state.copyWith(status: RequestStatus.failure, message: error.message),
      );
    }
  }
}

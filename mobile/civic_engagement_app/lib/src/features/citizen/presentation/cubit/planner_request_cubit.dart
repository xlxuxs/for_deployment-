import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/api_exception.dart';
import '../../domain/repositories/citizen_repository.dart';
import 'planner_request_state.dart';

class PlannerRequestCubit extends Cubit<PlannerRequestState> {
  PlannerRequestCubit(this._repository) : super(const PlannerRequestInitial());

  final CitizenRepository _repository;

  Future<void> submitRequest({
    String? organization,
    required String reason,
    String? applicantType,
    String? fullName,
    String? email,
    String? phone,
    String? region,
    String? proofFileBase64,
    String? proofFileName,
    String? proofFileMimeType,
  }) async {
    emit(const PlannerRequestLoading());
    try {
      final result = await _repository.requestPlannerStatus(
        organization: organization,
        reason: reason,
        applicantType: applicantType,
        fullName: fullName,
        email: email,
        phone: phone,
        region: region,
        proofFileBase64: proofFileBase64,
        proofFileName: proofFileName,
        proofFileMimeType: proofFileMimeType,
      );
      emit(
        PlannerRequestSuccess(
          requestId: result.requestId,
          message: 'Your request has been submitted. Admins will review it.',
        ),
      );
    } on ApiException catch (e) {
      emit(PlannerRequestError(message: e.message, code: e.code));
    } catch (e) {
      emit(
        PlannerRequestError(
          message: 'Failed to submit request. Please try again.',
        ),
      );
    }
  }

  void reset() {
    emit(const PlannerRequestInitial());
  }
}

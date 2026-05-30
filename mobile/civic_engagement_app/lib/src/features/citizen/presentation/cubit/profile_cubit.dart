import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/api_exception.dart';
import '../../../../core/state/request_status.dart';
import '../../domain/entities/user_profile.dart';
import '../../domain/repositories/citizen_repository.dart';

part 'profile_state.dart';

class ProfileCubit extends Cubit<ProfileState> {
  ProfileCubit(this._repository) : super(const ProfileState());

  final CitizenRepository _repository;

  Future<void> loadProfile() async {
    emit(state.copyWith(status: RequestStatus.loading));
    try {
      final profile = await _repository.getProfile();
      emit(state.copyWith(status: RequestStatus.success, profile: profile));
    } on ApiException catch (error) {
      emit(
        state.copyWith(status: RequestStatus.failure, message: error.message),
      );
    }
  }

  Future<void> updateRegion(String region) async {
    emit(state.copyWith(actionStatus: RequestStatus.loading));
    try {
      final profile = await _repository.updateRegion(region);
      emit(
        state.copyWith(
          profile: profile,
          actionStatus: RequestStatus.success,
          message: 'Region updated successfully.',
        ),
      );
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
    }
  }

  Future<void> updatePreferredLanguage(String preferredLanguage) async {
    emit(state.copyWith(actionStatus: RequestStatus.loading));
    try {
      final profile = await _repository.updatePreferredLanguage(
        preferredLanguage,
      );
      emit(
        state.copyWith(
          profile: profile,
          actionStatus: RequestStatus.success,
          message: 'Preferred language updated successfully.',
        ),
      );
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    emit(state.copyWith(actionStatus: RequestStatus.loading));
    try {
      final message = await _repository.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      emit(
        state.copyWith(actionStatus: RequestStatus.success, message: message),
      );
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
    }
  }

  Future<void> requestEmailChange(String newEmail) async {
    emit(state.copyWith(actionStatus: RequestStatus.loading));
    try {
      final message = await _repository.requestEmailChange(newEmail);
      emit(
        state.copyWith(actionStatus: RequestStatus.success, message: message),
      );
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
    }
  }

  Future<void> verifyEmailChange(String code) async {
    emit(state.copyWith(actionStatus: RequestStatus.loading));
    try {
      final message = await _repository.verifyEmailChange(code);
      emit(
        state.copyWith(actionStatus: RequestStatus.success, message: message),
      );
      await loadProfile();
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
    }
  }

  Future<void> requestPhoneChange(String newPhone) async {
    emit(state.copyWith(actionStatus: RequestStatus.loading));
    try {
      final message = await _repository.requestPhoneChange(newPhone);
      emit(
        state.copyWith(actionStatus: RequestStatus.success, message: message),
      );
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
    }
  }

  Future<void> verifyPhoneChange({
    required String newPhone,
    required String code,
  }) async {
    emit(state.copyWith(actionStatus: RequestStatus.loading));
    try {
      final message = await _repository.verifyPhoneChange(
        newPhone: newPhone,
        code: code,
      );
      emit(
        state.copyWith(actionStatus: RequestStatus.success, message: message),
      );
      // Note: Session is cleared by repository, user will be logged out
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
    }
  }

  Future<void> exportUserData() async {
    emit(state.copyWith(actionStatus: RequestStatus.loading));
    try {
      final path = await _repository.exportUserData();
      emit(
        state.copyWith(
          actionStatus: RequestStatus.success,
          message: 'User data exported to $path',
        ),
      );
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: 'Failed to export user data. Please try again.',
        ),
      );
    }
  }

  Future<String?> deleteAccount() async {
    emit(state.copyWith(actionStatus: RequestStatus.loading));
    try {
      final message = await _repository.deleteAccount();
      emit(
        state.copyWith(actionStatus: RequestStatus.success, message: message),
      );
      return null;
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          actionStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
      return error.message;
    }
  }
}

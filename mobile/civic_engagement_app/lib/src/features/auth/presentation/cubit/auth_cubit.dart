import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/api_exception.dart';
import '../../../../core/services/notification_socket_service.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/user_demographics.dart';
import '../../domain/repositories/auth_repository.dart';

part 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  AuthCubit(
    this._repository,
    this._socketService,
  ) : super(const AuthState.checking());

  final AuthRepository _repository;
  final NotificationSocketService _socketService;

  Future<void> restoreSession() async {
    final session = _repository.restoreSession();
    if (session == null) {
      emit(const AuthState.unauthenticated());
    } else {
      // Connect WebSocket on session restore
      _connectSocket(session);
      emit(AuthState.authenticated(session));
    }
  }

  /// Connect to WebSocket for real-time notifications
  void _connectSocket(AuthSession session) {
    // Only connect if userId is available
    if (session.userId == null) {
      print('Cannot connect WebSocket: userId is null');
      return;
    }

    print('Connecting WebSocket for user: ${session.userId}');
    _socketService.connect(session.userId!, session.token);
  }

  /// Disconnect WebSocket
  void _disconnectSocket() {
    print('Disconnecting WebSocket');
    _socketService.disconnect();
  }

  Future<void> register({
    required String email,
    required String password,
    required String phone,
    required String region,
    required UserDemographics demographics,
    String? captchaToken,
  }) async {
    emit(const AuthState.loading());
    try {
      final result = await _repository.register(
        email: email,
        password: password,
        phone: phone,
        region: region,
        demographics: demographics,
        captchaToken: captchaToken,
      );
      emit(AuthState.otpPending(email: email, message: result.message));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  Future<void> sendOtp(String email) async {
    emit(const AuthState.loading());
    try {
      final message = await _repository.sendOtp(email);
      emit(AuthState.otpPending(email: email, message: message));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  Future<void> verifyOtp({required String email, required String code}) async {
    emit(const AuthState.loading());
    try {
      final session = await _repository.verifyOtp(email: email, code: code);
      // Connect WebSocket after successful OTP verification
      _connectSocket(session);
      emit(AuthState.authenticated(session));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  Future<void> login({
    required String email,
    required String password,
    String? captchaToken,
  }) async {
    emit(const AuthState.loading());
    try {
      final session = await _repository.login(
        email: email,
        password: password,
        captchaToken: captchaToken,
      );
      // Connect WebSocket after successful login
      _connectSocket(session);
      emit(AuthState.authenticated(session));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  Future<void> forgotPassword(String email) async {
    emit(const AuthState.loading());
    try {
      final message = await _repository.forgotPassword(email);
      emit(AuthState.message(message));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    emit(const AuthState.loading());
    try {
      final message = await _repository.resetPassword(
        token: token,
        newPassword: newPassword,
      );
      emit(AuthState.passwordResetSuccess(message: message));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  Future<void> logout() async {
    // Disconnect WebSocket before logout
    _disconnectSocket();
    await _repository.logout();
    emit(const AuthState.unauthenticated());
  }

  // New: Email change feature
  Future<void> requestEmailChange(String newEmail) async {
    emit(const AuthState.loading());
    try {
      final message = await _repository.requestEmailChange(newEmail: newEmail);
      emit(AuthState.emailChangePending(newEmail: newEmail, message: message));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  Future<void> verifyEmailChange(String code) async {
    emit(const AuthState.loading());
    try {
      final message = await _repository.verifyEmailChange(code: code);
      emit(AuthState.message(message));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  // New: Phone change feature
  Future<void> requestPhoneChange(String newPhone) async {
    emit(const AuthState.loading());
    try {
      final message = await _repository.requestPhoneChange(newPhone: newPhone);
      emit(AuthState.phoneChangePending(newPhone: newPhone, message: message));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  Future<void> verifyPhoneChange({
    required String newPhone,
    required String code,
  }) async {
    emit(const AuthState.loading());
    try {
      final message = await _repository.verifyPhoneChange(
        newPhone: newPhone,
        code: code,
      );
      // Phone change invalidates token, disconnect socket and require re-login
      _disconnectSocket();
      emit(AuthState.phoneChangeSuccess(message: message));
    } on ApiException catch (error) {
      emit(AuthState.failure(error.message));
    }
  }

  @override
  Future<void> close() {
    _disconnectSocket();
    return super.close();
  }
}

import '../../../../core/error/api_exception.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/session/session_store.dart';
import '../../domain/entities/auth_session.dart';
import '../../domain/entities/registration_result.dart';
import '../../domain/entities/user_demographics.dart';
import '../../domain/repositories/auth_repository.dart';

class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl(this._apiClient, this._sessionStore);

  final ApiClient _apiClient;
  final SessionStore _sessionStore;

  @override
  AuthSession? restoreSession() => _sessionStore.restore();

  @override
  Future<RegistrationResult> register({
    required String email,
    required String password,
    required String phone,
    required String region,
    required UserDemographics demographics,
    String? captchaToken,
  }) async {
    final trimmedCaptcha = captchaToken?.trim();
    final response = await _apiClient.post(
      '/auth/register',
      authenticated: false,
      body: {
        'email': email.trim(),
        'password': password,
        'phone': phone.trim(),
        'region': region.trim(),
        'ageRange': demographics.ageRange,
        'gender': demographics.gender,
        'occupation': demographics.occupation,
        'education': demographics.education,
        if (trimmedCaptcha != null && trimmedCaptcha.isNotEmpty)
          'captchaToken': trimmedCaptcha,
      },
    );
    final data = response.data as Map<String, dynamic>? ?? {};
    return RegistrationResult(
      userId: data['userId']?.toString() ?? '',
      message: response.message,
    );
  }

  @override
  Future<String> sendOtp(String email) async {
    final response = await _apiClient.post(
      '/auth/send-otp',
      authenticated: false,
      body: {'email': email.trim()},
    );
    return response.message;
  }

  @override
  Future<AuthSession> verifyOtp({
    required String email,
    required String code,
  }) async {
    final response = await _apiClient.post(
      '/auth/verify-otp',
      authenticated: false,
      body: {'email': email.trim(), 'code': code.trim()},
    );
    return _saveSession(response.data as Map<String, dynamic>? ?? {});
  }

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
    String? captchaToken,
  }) async {
    final trimmedCaptcha = captchaToken?.trim();
    final response = await _apiClient.post(
      '/auth/login',
      authenticated: false,
      body: {
        'email': email.trim(),
        'password': password,
        if (trimmedCaptcha != null && trimmedCaptcha.isNotEmpty)
          'captchaToken': trimmedCaptcha,
      },
    );
    return _saveSession(response.data as Map<String, dynamic>? ?? {});
  }

  @override
  Future<String> forgotPassword(String email) async {
    final response = await _apiClient.post(
      '/auth/forgot-password',
      authenticated: false,
      body: {'email': email.trim()},
    );
    return response.message;
  }

  @override
  Future<String> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    final response = await _apiClient.post(
      '/auth/reset-password',
      authenticated: false,
      body: {'token': token.trim(), 'newPassword': newPassword},
    );
    return response.message;
  }

  @override
  Future<void> logout() => _sessionStore.clear();

  // New: Email change feature
  @override
  Future<String> requestEmailChange({required String newEmail}) async {
    final response = await _apiClient.post(
      '/users/me/email/request',
      authenticated: true,
      body: {'newEmail': newEmail.trim()},
    );
    return response.message;
  }

  @override
  Future<String> verifyEmailChange({required String code}) async {
    final response = await _apiClient.post(
      '/users/me/email/verify',
      authenticated: true,
      body: {'code': code.trim()},
    );
    return response.message;
  }

  // New: Phone change feature
  @override
  Future<String> requestPhoneChange({required String newPhone}) async {
    final response = await _apiClient.post(
      '/users/me/phone/request',
      authenticated: true,
      body: {'newPhone': newPhone.trim()},
    );
    return response.message;
  }

  @override
  Future<String> verifyPhoneChange({
    required String newPhone,
    required String code,
  }) async {
    final response = await _apiClient.post(
      '/users/me/phone/verify',
      authenticated: true,
      body: {
        'newPhone': newPhone.trim(),
        'otp': code.trim(),
      },
    );
    // Phone change invalidates token, so clear session
    await _sessionStore.clear();
    return response.message;
  }

  Future<AuthSession> _saveSession(Map<String, dynamic> data) async {
    final session = AuthSession(
      token: data['token']?.toString() ?? '',
      role: data['role']?.toString() ?? '',
      userId: data['userId']?.toString(),
    );

    if (session.token.isEmpty) {
      throw ApiException(message: 'The server did not return a valid token.');
    }
    if (!session.isCitizen) {
      throw ApiException(message: 'Only citizen accounts can use this app.');
    }

    await _sessionStore.save(session);
    return session;
  }
}

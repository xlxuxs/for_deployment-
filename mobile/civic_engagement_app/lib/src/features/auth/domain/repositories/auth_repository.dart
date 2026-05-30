import '../entities/auth_session.dart';
import '../entities/registration_result.dart';
import '../entities/user_demographics.dart';

abstract class AuthRepository {
  AuthSession? restoreSession();

  Future<RegistrationResult> register({
    required String email,
    required String password,
    required String phone,
    required String region,
    required UserDemographics demographics,
    String? captchaToken,
  });

  Future<String> sendOtp(String email);

  Future<AuthSession> verifyOtp({required String email, required String code});

  Future<AuthSession> login({
    required String email,
    required String password,
    String? captchaToken,
  });

  Future<String> forgotPassword(String email);

  Future<String> resetPassword({
    required String token,
    required String newPassword,
  });

  // New: Email change feature
  Future<String> requestEmailChange({required String newEmail});

  Future<String> verifyEmailChange({required String code});

  // New: Phone change feature
  Future<String> requestPhoneChange({required String newPhone});

  Future<String> verifyPhoneChange({
    required String newPhone,
    required String code,
  });

  Future<void> logout();
}

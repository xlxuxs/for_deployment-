import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/domain/entities/auth_session.dart';

class SessionStore {
  SessionStore(this._preferences);

  final SharedPreferences _preferences;

  static const _tokenKey = 'auth_token';
  static const _roleKey = 'auth_role';
  static const _userIdKey = 'auth_user_id';

  Future<void> save(AuthSession session) async {
    await _preferences.setString(_tokenKey, session.token);
    await _preferences.setString(_roleKey, session.role);
    if (session.userId != null) {
      await _preferences.setString(_userIdKey, session.userId!);
    }
  }

  AuthSession? restore() {
    final token = _preferences.getString(_tokenKey);
    final role = _preferences.getString(_roleKey);
    if (token == null || role == null) return null;
    return AuthSession(
      token: token,
      role: role,
      userId: _preferences.getString(_userIdKey),
    );
  }

  String? get token => _preferences.getString(_tokenKey);

  Future<void> clear() async {
    await _preferences.remove(_tokenKey);
    await _preferences.remove(_roleKey);
    await _preferences.remove(_userIdKey);
  }
}

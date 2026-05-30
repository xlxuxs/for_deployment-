import 'package:equatable/equatable.dart';

class AuthSession extends Equatable {
  const AuthSession({required this.token, required this.role, this.userId});

  final String token;
  final String role;
  final String? userId;

  bool get isCitizen => role == 'citizen';

  @override
  List<Object?> get props => [token, role, userId];
}

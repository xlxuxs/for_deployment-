import 'package:equatable/equatable.dart';

class RegistrationResult extends Equatable {
  const RegistrationResult({required this.userId, required this.message});

  final String userId;
  final String message;

  @override
  List<Object?> get props => [userId, message];
}

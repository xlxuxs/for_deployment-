import 'package:equatable/equatable.dart';

class UserProfile extends Equatable {
  const UserProfile({
    required this.id,
    required this.email,
    required this.region,
    required this.role,
    required this.verified,
    required this.active,
    this.preferredLanguage = 'en',
    this.fullName,
    this.phone,
    this.createdAt,
  });

  final String id;
  final String email;
  final String region;
  final String role;
  final bool verified;
  final bool active;
  final String preferredLanguage;
  final String? fullName;
  final String? phone;
  final DateTime? createdAt;

  @override
  List<Object?> get props => [
        id,
        email,
        region,
        role,
        verified,
        active,
        preferredLanguage,
        fullName,
        phone,
        createdAt,
      ];
}

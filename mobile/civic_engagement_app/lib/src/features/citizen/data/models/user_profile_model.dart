import '../../domain/entities/user_profile.dart';

class UserProfileModel extends UserProfile {
  const UserProfileModel({
    required super.id,
    required super.email,
    required super.region,
    required super.role,
    required super.verified,
    required super.active,
    super.preferredLanguage,
    super.fullName,
    super.phone,
    super.createdAt,
  });

  factory UserProfileModel.fromJson(Map<String, dynamic> json) {
    return UserProfileModel(
      id: (json['_id'] ?? json['id'] ?? '').toString(),
      email: json['email']?.toString() ?? '',
      region: json['region']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
      verified: json['verified'] == true,
      active: json['active'] != false,
      preferredLanguage: json['preferredLanguage']?.toString() ?? 'en',
      fullName: (json['fullName'] ?? json['name'])?.toString(),
      phone: (json['phone'] ?? json['phoneNumber'])?.toString(),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }
}

import 'package:equatable/equatable.dart';

/// Types of user interactions with policies
enum InteractionType {
  view,
  vote,
  comment;

  String toJson() => name;

  static InteractionType fromJson(String json) {
    return InteractionType.values.firstWhere(
      (type) => type.name == json,
      orElse: () => InteractionType.view,
    );
  }
}

/// Represents a user interaction with a policy
class UserInteraction extends Equatable {
  final String policyId;
  final InteractionType type;

  const UserInteraction({
    required this.policyId,
    required this.type,
  });

  Map<String, dynamic> toJson() => {
        'policyId': policyId,
        'type': type.toJson(),
      };

  @override
  List<Object?> get props => [policyId, type];
}

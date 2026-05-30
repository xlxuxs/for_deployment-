part of 'profile_cubit.dart';

class ProfileState extends Equatable {
  const ProfileState({
    this.status = RequestStatus.initial,
    this.actionStatus = RequestStatus.initial,
    this.profile,
    this.message,
  });

  final RequestStatus status;
  final RequestStatus actionStatus;
  final UserProfile? profile;
  final String? message;

  ProfileState copyWith({
    RequestStatus? status,
    RequestStatus? actionStatus,
    UserProfile? profile,
    String? message,
  }) {
    return ProfileState(
      status: status ?? this.status,
      actionStatus: actionStatus ?? this.actionStatus,
      profile: profile ?? this.profile,
      message: message,
    );
  }

  @override
  List<Object?> get props => [status, actionStatus, profile, message];
}

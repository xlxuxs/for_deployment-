import '../entities/comment.dart';
import '../entities/notification_page.dart';
import '../entities/planner_request.dart';
import '../entities/policy.dart';
import '../entities/policy_page.dart';
import '../entities/user_profile.dart';
import '../entities/vote_history.dart';
import '../entities/vote_receipt.dart';
import '../entities/feed_policy.dart';
import '../entities/user_interaction.dart';

abstract class CitizenRepository {
  Future<UserProfile> getProfile();

  Future<UserProfile> updateRegion(String region);

  Future<UserProfile> updatePreferredLanguage(String preferredLanguage);

  Future<String> changePassword({
    required String currentPassword,
    required String newPassword,
  });

  Future<String> requestEmailChange(String newEmail);

  Future<String> verifyEmailChange(String code);

  Future<String> requestPhoneChange(String newPhone);

  Future<String> verifyPhoneChange({
    required String newPhone,
    required String code,
  });

  Future<String> deleteAccount();

  Future<String> exportUserData({
    DateTime? startDate,
    DateTime? endDate,
  });

  // Policy endpoints (Section 3)
  Future<PolicyPage> getPolicies({
    String? status,
    String? topic,
    List<String>? topics, // NEW: Support multiple topics
    bool includeArchived = false, // NEW: Include archived policies
    int page = 1,
    int limit = 20,
  });

  Future<Policy> getPolicy(String id);

  // Voting endpoint (Section 4.1)
  Future<VoteReceipt> submitVote({
    required String policyId,
    required dynamic
        value, // Can be int, String, or List<String> based on poll type
    String? comment,
  });

  Future<String> addComment(
      {required String policyId, required String comment});

  // Comment endpoints (Section 4.2-4.8)
  Future<String> postComment({
    required String policyId,
    required String text,
    String? parentCommentId,
  });

  Future<String> reportComment({
    required String commentId,
    required String reason,
  });

  Future<String> editComment({
    required String commentId,
    required String text,
  });

  Future<String> appealComment({
    required String commentId,
    required String reason,
  });

  // UPDATED: Use public endpoint instead of analytics endpoint
  Future<CommentPage> getPolicyComments({
    required String policyId,
    int page = 1,
    int limit = 20,
  });

  // NEW: Get single comment by ID (Section 4.4)
  Future<Comment> getComment(String commentId);

  Future<String> translateText({
    required String text,
    String? sourceLang,
    String? targetLang,
  });

  // NEW: Get replies for a comment
  Future<CommentPage> getCommentReplies({
    required String commentId,
    int page = 1,
    int limit = 20,
  });

  Future<List<VoteHistory>> getHistory();

  Future<NotificationPage> getNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  });

  Future<void> markNotificationRead(String id);

  Future<int> markAllNotificationsRead();

  // Planner onboarding (Section 10.1)
  Future<PlannerRequest> requestPlannerStatus({
    String? organization,
    required String reason,
    String? applicantType,
    String? fullName,
    String? email,
    String? phone,
    String? region,
    String? proofFileBase64,
    String? proofFileName,
    String? proofFileMimeType,
  });

  // Personalized Feed (Section 13)
  Future<List<FeedPolicy>> getPersonalizedFeed();

  Future<void> recordInteraction(UserInteraction interaction);
}

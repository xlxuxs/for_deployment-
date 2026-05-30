import 'dart:convert';

import '../../../../core/error/api_exception.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/services/json_export_saver.dart';
import '../../../../core/session/session_store.dart';
import '../../domain/entities/comment.dart';
import '../../domain/entities/notification_page.dart';
import '../../domain/entities/planner_request.dart';
import '../../domain/entities/policy.dart';
import '../../domain/entities/policy_page.dart';
import '../../domain/entities/user_profile.dart';
import '../../domain/entities/vote_history.dart';
import '../../domain/entities/vote_receipt.dart';
import '../../domain/entities/feed_policy.dart';
import '../../domain/entities/user_interaction.dart';
import '../../domain/repositories/citizen_repository.dart';
import '../models/citizen_notification_model.dart';
import '../models/comment_model.dart';
import '../models/planner_request_model.dart';
import '../models/policy_model.dart';
import '../models/user_profile_model.dart';
import '../models/vote_history_model.dart';
import '../models/feed_policy_model.dart';

class CitizenRepositoryImpl implements CitizenRepository {
  CitizenRepositoryImpl(this._apiClient, this._sessionStore);

  final ApiClient _apiClient;
  final SessionStore _sessionStore;

  @override
  Future<UserProfile> getProfile() async {
    final response = await _apiClient.get('/users/me');
    return UserProfileModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<UserProfile> updateRegion(String region) async {
    final response = await _apiClient.put(
      '/users/me',
      body: {'region': region.trim()},
    );
    return UserProfileModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<UserProfile> updatePreferredLanguage(String preferredLanguage) async {
    final response = await _apiClient.put(
      '/users/me',
      body: {'preferredLanguage': preferredLanguage.trim()},
    );
    return UserProfileModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<String> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await _apiClient.put(
      '/users/me/password',
      body: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
    return response.message;
  }

  @override
  Future<String> requestEmailChange(String newEmail) async {
    final response = await _apiClient.post(
      '/users/me/email/request',
      body: {'newEmail': newEmail.trim()},
    );
    return response.message;
  }

  @override
  Future<String> verifyEmailChange(String code) async {
    final response = await _apiClient.post(
      '/users/me/email/verify',
      body: {'code': code.trim()},
    );
    return response.message;
  }

  @override
  Future<String> requestPhoneChange(String newPhone) async {
    final response = await _apiClient.post(
      '/users/me/phone/request',
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
      body: {
        'newPhone': newPhone.trim(),
        'otp': code.trim(),
      },
    );
    // Phone change invalidates token, so clear session
    await _sessionStore.clear();
    return response.message;
  }

  @override
  Future<String> deleteAccount() async {
    final response = await _apiClient.delete('/users/me');
    await _sessionStore.clear();
    return response.message;
  }

  @override
  Future<String> exportUserData({
    DateTime? startDate,
    DateTime? endDate,
  }) async {
    final response = await _apiClient.get(
      '/users/me/export',
      query: {
        if (startDate != null) 'startDate': _dateOnly(startDate),
        if (endDate != null) 'endDate': _dateOnly(endDate),
      },
    );
    final jsonText = const JsonEncoder.withIndent('  ').convert(response.data);
    final timestamp = DateTime.now()
        .toIso8601String()
        .replaceAll(':', '-')
        .replaceAll('.', '-');
    return saveJsonExport(
      fileName: 'civic-voice-user-data-$timestamp.json',
      jsonText: jsonText,
    );
  }

  @override
  Future<PolicyPage> getPolicies({
    String? status,
    String? topic,
    List<String>? topics,
    bool includeArchived = false,
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _apiClient.get(
      '/policies',
      query: {
        if (status != null && status != 'all') 'status': status,
        if (topic != null && topic.isNotEmpty) 'topic': topic,
        if (topics != null && topics.isNotEmpty) 'topic': topics,
        if (includeArchived) 'includeArchived': true,
        'page': page,
        'limit': limit,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final rawPolicies = data['policies'];
    final allowedStatuses = status == null || status == 'all'
        ? const {'active', 'paused'}
        : {status};
    final policies = rawPolicies is List
        ? rawPolicies
            .whereType<Map<String, dynamic>>()
            .map(PolicyModel.fromJson)
            .where((policy) => allowedStatuses.contains(policy.status))
            .toList()
        : <Policy>[];
    return PolicyPage(
      policies: policies,
      total: _toInt(data['total'], fallback: policies.length),
      page: _toInt(data['page'], fallback: page),
    );
  }

  @override
  Future<Policy> getPolicy(String id) async {
    final response = await _apiClient.get('/policies/$id');
    return PolicyModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<VoteReceipt> submitVote({
    required String policyId,
    required dynamic value,
    String? comment,
  }) async {
    final body = <String, dynamic>{'policyId': policyId, 'value': value};
    final trimmedComment = comment?.trim();
    if (trimmedComment != null && trimmedComment.isNotEmpty) {
      body['comment'] = trimmedComment;
    }
    final response = await _apiClient.post('/votes', body: body);
    final data = response.data as Map<String, dynamic>? ?? {};
    return VoteReceipt(
      voteId: data['voteId']?.toString() ?? '',
      commentId: data['commentId']?.toString(),
      value: data['value'] ?? value,
      message: response.message,
    );
  }

  @override
  Future<String> addComment({
    required String policyId,
    required String comment,
  }) async {
    final response = await _apiClient.post(
      '/comments',
      body: {
        'policyId': policyId,
        'text': comment.trim(),
      },
    );
    return response.message;
  }

  @override
  Future<String> postComment({
    required String policyId,
    required String text,
    String? parentCommentId,
  }) async {
    final response = await _apiClient.post(
      '/comments',
      body: {
        'policyId': policyId,
        'text': text.trim(),
        if (parentCommentId != null) 'parentCommentId': parentCommentId,
      },
    );
    return response.message;
  }

  @override
  Future<String> reportComment({
    required String commentId,
    required String reason,
  }) async {
    final response = await _apiClient.post(
      '/comments/$commentId/report',
      body: {'reason': reason},
    );
    return response.message;
  }

  @override
  Future<String> editComment({
    required String commentId,
    required String text,
  }) async {
    final response = await _apiClient.put(
      '/comments/$commentId',
      body: {'text': text.trim()},
    );
    return response.message;
  }

  @override
  Future<String> appealComment({
    required String commentId,
    required String reason,
  }) async {
    final response = await _apiClient.post(
      '/comments/$commentId/appeal',
      body: {'reason': reason.trim()},
    );
    return response.message;
  }

  @override
  Future<CommentPage> getPolicyComments({
    required String policyId,
    int page = 1,
    int limit = 20,
  }) async {
    // UPDATED: Use public endpoint instead of analytics endpoint
    final response = await _apiClient.get(
      '/comments/policy/$policyId',
      query: {
        'page': page,
        'limit': limit,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final rawComments = data['comments'];
    final comments = rawComments is List
        ? rawComments
            .whereType<Map<String, dynamic>>()
            .map(CommentModel.fromJson)
            .toList()
        : <CommentModel>[];
    return CommentPage(
      comments: comments,
      total: _toInt(data['total']),
      page: _toInt(data['page'], fallback: page),
    );
  }

  @override
  Future<Comment> getComment(String commentId) async {
    final response = await _apiClient.get('/comments/$commentId');
    return CommentModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<String> translateText({
    required String text,
    String? sourceLang,
    String? targetLang,
  }) async {
    try {
      final response = await _apiClient.post(
        '/translate',
        body: {
          'text': text.trim(),
          if (sourceLang != null && sourceLang.trim().isNotEmpty)
            'sourceLang': sourceLang.trim(),
          if (targetLang != null && targetLang.trim().isNotEmpty)
            'targetLang': targetLang.trim(),
        },
      );
      final data = response.data as Map<String, dynamic>? ?? {};
      return data['translatedText']?.toString() ??
          data['translation']?.toString() ??
          '';
    } on ApiException catch (error) {
      final normalized = error.message.toLowerCase();
      if (normalized.contains('translation') &&
          (normalized.contains('not configured') ||
              normalized.contains('unavailable') ||
              normalized.contains('service'))) {
        throw ApiException(
          code: error.code,
          statusCode: error.statusCode,
          message:
              'Translation is temporarily unavailable. Please try again later.',
        );
      }
      rethrow;
    }
  }

  @override
  Future<CommentPage> getCommentReplies({
    required String commentId,
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _apiClient.get(
      '/comments/$commentId/replies',
      query: {
        'page': page,
        'limit': limit,
      },
    );
    final data = response.data as Map<String, dynamic>;
    final rawReplies = data['replies'];
    final replies = rawReplies is List
        ? rawReplies
            .whereType<Map<String, dynamic>>()
            .map(CommentModel.fromJson)
            .toList()
        : <CommentModel>[];
    return CommentPage(
      comments: replies,
      total: _toInt(data['total']),
      page: _toInt(data['page'], fallback: page),
    );
  }

  @override
  Future<List<VoteHistory>> getHistory() async {
    final response = await _apiClient.get('/users/me/history');
    final data = response.data as Map<String, dynamic>;
    final rawHistory = data['history'];
    if (rawHistory is! List) return const [];
    return rawHistory
        .whereType<Map<String, dynamic>>()
        .map(VoteHistoryModel.fromJson)
        .toList();
  }

  @override
  Future<NotificationPage> getNotifications({
    int page = 1,
    int limit = 20,
    bool unreadOnly = false,
  }) async {
    final response = await _apiClient.get(
      '/users/me/notifications',
      query: {'page': page, 'limit': limit, if (unreadOnly) 'unreadOnly': true},
    );
    final data = response.data as Map<String, dynamic>;
    final rawNotifications = data['notifications'];
    final notifications = rawNotifications is List
        ? rawNotifications
            .whereType<Map<String, dynamic>>()
            .map(CitizenNotificationModel.fromJson)
            .toList()
        : <CitizenNotificationModel>[];

    return NotificationPage(
      notifications: notifications,
      total: _toInt(data['total']),
      page: _toInt(data['page'], fallback: page),
    );
  }

  @override
  Future<void> markNotificationRead(String id) async {
    await _apiClient.patch('/users/me/notifications/$id/read');
  }

  @override
  Future<int> markAllNotificationsRead() async {
    final response = await _apiClient.patch('/users/me/notifications/read-all');
    final data = response.data as Map<String, dynamic>? ?? {};
    return _toInt(data['modifiedCount']);
  }

  @override
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
  }) async {
    final body = <String, dynamic>{
      'reason': reason.trim(),
    };
    final trimmedOrg = organization?.trim();
    if (trimmedOrg != null && trimmedOrg.isNotEmpty) {
      body['organization'] = trimmedOrg;
    }
    final fields = <String, String?>{
      'applicantType': applicantType,
      'fullName': fullName,
      'email': email,
      'phone': phone,
      'region': region,
    };
    fields.forEach((key, value) {
      final trimmed = value?.trim();
      if (trimmed != null && trimmed.isNotEmpty) {
        body[key] = trimmed;
      }
    });
    final trimmedProof = proofFileBase64?.trim();
    if (trimmedProof != null && trimmedProof.isNotEmpty) {
      body['proofFile'] = trimmedProof;
      if (proofFileName != null && proofFileName.trim().isNotEmpty) {
        body['proofFileName'] = proofFileName.trim();
      }
      if (proofFileMimeType != null && proofFileMimeType.trim().isNotEmpty) {
        body['proofFileMimeType'] = proofFileMimeType.trim();
      }
    }
    final response = await _apiClient.post(
      '/planners/request',
      body: body,
      authenticated: _sessionStore.token != null,
    );
    final data = response.data as Map<String, dynamic>? ?? {};
    return PlannerRequestModel.fromJson(data);
  }

  @override
  Future<List<FeedPolicy>> getPersonalizedFeed() async {
    final response = await _apiClient.get('/feed');
    final data = response.data;

    if (data is! List) {
      return [];
    }

    return data
        .whereType<Map<String, dynamic>>()
        .map(FeedPolicyModel.fromJson)
        .toList();
  }

  @override
  Future<void> recordInteraction(UserInteraction interaction) async {
    await _apiClient.post(
      '/feed/interact',
      body: interaction.toJson(),
    );
  }

  static int _toInt(dynamic value, {int fallback = 0}) {
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? fallback;
  }

  static String _dateOnly(DateTime value) {
    final year = value.year.toString().padLeft(4, '0');
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');
    return '$year-$month-$day';
  }
}

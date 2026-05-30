/// Local seed payloads for citizen-flow testing.
///
/// This file is intentionally not registered in production dependency
/// injection. Tests and debug-only tools can import it to avoid hand-creating
/// users, policies, votes, comments, notifications, planner requests, appeals,
/// history, and translation responses.
class CitizenSampleData {
  const CitizenSampleData._();

  static bool get isDebugOnly {
    var enabled = false;
    assert(enabled = true);
    return enabled;
  }

  static const authSession = {
    'token': 'sample-citizen-token',
    'role': 'citizen',
    'userId': sampleUserId,
  };

  static const sampleUserId = 'citizen_sample_001';
  static const samplePolicyId = 'policy_sample_001';
  static const sampleCommentId = 'comment_sample_001';
  static const sampleHiddenCommentId = 'comment_sample_hidden_001';
  static const samplePlannerRequestId = 'planner_request_sample_001';

  static final user = {
    '_id': sampleUserId,
    'email': 'citizen@example.com',
    'fullName': 'Sample Citizen',
    'phone': '+251912345678',
    'region': 'Addis Ababa',
    'preferredLanguage': 'am',
    'role': 'citizen',
    'verified': true,
    'active': true,
    'createdAt': '2026-05-01T09:00:00Z',
  };

  static final policies = [
    {
      'id': samplePolicyId,
      'title': 'Clean Water Access',
      'description': 'Improve reliable water access for underserved kebeles.',
      'policyCode': 'WATER26',
      'targetRegions': ['Addis Ababa'],
      'startDate': '2026-05-01T00:00:00Z',
      'endDate': '2026-08-31T23:59:59Z',
      'status': 'active',
      'pollType': 'multipleChoice',
      'pollOptions': [
        {'id': 'wells', 'text': 'Build community wells', 'shortCode': '1'},
        {'id': 'pipes', 'text': 'Repair pipe networks', 'shortCode': '2'},
      ],
      'maxSelections': 1,
      'averageRating': 0,
      'totalVotes': 128,
      'topics': ['Water Supply', 'Infrastructure'],
      'createdBy': 'planner@example.com',
      'createdAt': '2026-04-20T10:00:00Z',
    },
    {
      'id': 'policy_sample_002',
      'title': 'Neighborhood Transit Safety',
      'description': 'Collect resident feedback on safer bus stops.',
      'policyCode': 'TRANS26',
      'targetRegions': ['Addis Ababa'],
      'startDate': '2026-04-15T00:00:00Z',
      'endDate': '2026-07-15T23:59:59Z',
      'status': 'paused',
      'pollType': 'rating',
      'averageRating': 3.8,
      'totalVotes': 74,
      'topics': ['Transport', 'Public Safety'],
      'createdBy': 'planner@example.com',
      'createdAt': '2026-04-10T10:00:00Z',
    },
  ];

  static final policyPage = {
    'policies': policies,
    'total': policies.length,
    'page': 1,
  };

  static final feed = [
    {
      'policy': policies.first,
      'score': 0.91,
      'reason': 'Matches your region and water-supply interests.',
    },
  ];

  static const voteReceipt = {
    'voteId': 'vote_sample_001',
    'commentId': sampleCommentId,
    'value': 'pipes',
  };

  static final comments = [
    {
      'id': sampleCommentId,
      '_id': sampleCommentId,
      'policyId': samplePolicyId,
      'userId': sampleUserId,
      'userEmail': 'citizen@example.com',
      'text': 'Repairing existing pipe networks should come first.',
      'visibility': 'visible',
      'moderationStatus': 'reviewed',
      'sentiment': {'label': 'positive', 'confidence': 0.84},
      'keywords': ['pipes', 'repair', 'water'],
      'createdAt': '2026-05-10T12:00:00Z',
      'updatedAt': '2026-05-10T12:00:00Z',
    },
    {
      'id': sampleHiddenCommentId,
      '_id': sampleHiddenCommentId,
      'policyId': samplePolicyId,
      'userId': sampleUserId,
      'userEmail': 'citizen@example.com',
      'text': 'This hidden comment is used to test appeal submission.',
      'visibility': 'hidden',
      'hiddenReason': 'reports',
      'moderationStatus': 'needs_review',
      'createdAt': '2026-05-11T12:00:00Z',
      'updatedAt': '2026-05-11T12:00:00Z',
    },
  ];

  static final commentPage = {
    'comments': comments,
    'total': comments.length,
    'page': 1,
  };

  static final appealSubmitted = {
    'status': 'success',
    'data': null,
    'message': 'Appeal submitted. The policy maker will review.',
  };

  static final notifications = {
    'notifications': [
      {
        '_id': 'notification_sample_policy',
        'userId': sampleUserId,
        'userRole': 'citizen',
        'type': 'POLICY_EXTENDED',
        'title': 'Policy extended',
        'message': 'Clean Water Access is open for feedback for longer.',
        'data': {'policyId': samplePolicyId},
        'read': false,
        'severity': 'info',
        'source': 'system',
        'createdAt': '2026-05-12T12:00:00Z',
      },
      {
        '_id': 'notification_sample_planner',
        'userId': sampleUserId,
        'userRole': 'citizen',
        'type': 'PLANNER_REQUEST_APPROVED',
        'title': 'Planner request approved',
        'message': 'Your planner request was approved.',
        'data': {'requestId': samplePlannerRequestId},
        'read': false,
        'severity': 'info',
        'source': 'system',
        'createdAt': '2026-05-13T12:00:00Z',
      },
    ],
    'total': 2,
    'page': 1,
  };

  static final plannerRequest = {
    'requestId': samplePlannerRequestId,
    'fullName': 'Sample Citizen',
    'email': 'citizen@example.com',
    'phone': '+251912345678',
    'region': 'Addis Ababa',
    'organization': 'Community Policy Lab',
    'reason':
        'I work with local residents and need planner access to create policies for testing.',
    'proofFile': 'sample-base64-proof',
    'status': 'pending',
  };

  static final history = {
    'history': [
      {
        'policyId': samplePolicyId,
        'policyTitle': 'Clean Water Access',
        'voteId': 'vote_sample_001',
        'value': 'pipes',
        'comment': 'Repairing existing pipe networks should come first.',
        'createdAt': '2026-05-10T12:00:00Z',
      },
    ],
  };

  static const translation = {
    'translatedText': 'Existing pipe networks should be repaired first.',
  };

  static final routeResponses = {
    'POST /auth/login': {'data': authSession, 'message': 'Login successful.'},
    'POST /auth/register': {
      'data': {'userId': sampleUserId},
      'message': 'User registered successfully. A 6-digit OTP has been sent.',
    },
    'GET /users/me': {'data': user},
    'GET /policies': {'data': policyPage},
    'GET /feed': {'data': feed},
    'POST /votes': {'data': voteReceipt, 'message': 'Vote submitted.'},
    'GET /comments/policy/$samplePolicyId': {'data': commentPage},
    'GET /users/me/notifications': {'data': notifications},
    'GET /users/me/history': {'data': history},
    'POST /planners/request': {
      'data': plannerRequest,
      'message': 'Your request has been submitted. Admins will review it.',
    },
    'POST /comments/$sampleHiddenCommentId/appeal': appealSubmitted,
    'POST /translate': {
      'data': translation,
      'message': 'Translation successful',
    },
  };
}

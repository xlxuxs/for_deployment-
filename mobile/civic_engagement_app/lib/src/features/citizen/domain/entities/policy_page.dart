import 'package:equatable/equatable.dart';

import 'policy.dart';

class PolicyPage extends Equatable {
  const PolicyPage({
    required this.policies,
    required this.total,
    required this.page,
  });

  final List<Policy> policies;
  final int total;
  final int page;

  bool get hasMore => policies.length < total;

  @override
  List<Object?> get props => [policies, total, page];
}

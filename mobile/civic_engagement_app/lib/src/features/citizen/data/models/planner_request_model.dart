import '../../domain/entities/planner_request.dart';

class PlannerRequestModel extends PlannerRequest {
  const PlannerRequestModel({
    required super.requestId,
  });

  factory PlannerRequestModel.fromJson(Map<String, dynamic> json) {
    return PlannerRequestModel(
      requestId: json['requestId']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'requestId': requestId,
    };
  }
}

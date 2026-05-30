import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/error/api_exception.dart';
import '../../../../core/state/request_status.dart';
import '../../domain/entities/policy.dart';
import '../../domain/repositories/citizen_repository.dart';

part 'policy_state.dart';

class PolicyCubit extends Cubit<PolicyState> {
  PolicyCubit(this._repository) : super(const PolicyState());

  final CitizenRepository _repository;
  static const _pageSize = 20;

  Future<void> loadPolicies({
    String? status,
    String? topic,
    List<String>? topics,  // NEW: Support multiple topics
    bool refresh = true,
  }) async {
    final selectedStatus = status ?? state.filter;
    final selectedTopic = topic ?? state.topicFilter;
    final selectedTopics = topics ?? state.topicFilters;  // NEW
    final nextPage = refresh ? 1 : state.page + 1;
    
    emit(
      state.copyWith(
        status: RequestStatus.loading,
        filter: selectedStatus,
        topicFilter: selectedTopic,
        topicFilters: selectedTopics,  // NEW
      ),
    );
    
    try {
      final page = await _repository.getPolicies(
        status: selectedStatus == 'all' ? null : selectedStatus,
        topic: selectedTopic,
        topics: selectedTopics.isEmpty ? null : selectedTopics,  // NEW
        page: nextPage,
        limit: _pageSize,
      );
      
      final policies =
          refresh
              ? page.policies
              : <Policy>[...state.policies, ...page.policies];
              
      emit(
        state.copyWith(
          status: RequestStatus.success,
          policies: policies,
          page: page.page,
          total: page.total,
          hasMore: policies.length < page.total,
          filter: selectedStatus,
          topicFilter: selectedTopic,
          topicFilters: selectedTopics,  // NEW
          message: null, // Clear any previous error messages
        ),
      );
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          status: RequestStatus.failure,
          message: error.message,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: RequestStatus.failure,
          message: 'Could not connect to server. Please check your connection and try again.',
        ),
      );
    }
  }

  // NEW: Add topic to filter list
  void addTopicFilter(String topic) {
    if (!state.topicFilters.contains(topic)) {
      final newTopics = [...state.topicFilters, topic];
      loadPolicies(topics: newTopics, refresh: true);
    }
  }

  // NEW: Remove topic from filter list
  void removeTopicFilter(String topic) {
    final newTopics = state.topicFilters.where((t) => t != topic).toList();
    loadPolicies(topics: newTopics, refresh: true);
  }

  // NEW: Clear all topic filters
  void clearTopicFilters() {
    loadPolicies(topics: [], refresh: true);
  }

  Future<void> loadPolicy(String id) async {
    emit(state.copyWith(detailStatus: RequestStatus.loading));
    try {
      final policy = await _repository.getPolicy(id);
      emit(
        state.copyWith(
          detailStatus: RequestStatus.success,
          selectedPolicy: policy,
          message: null, // Clear any previous error messages
        ),
      );
    } on ApiException catch (error) {
      emit(
        state.copyWith(
          detailStatus: RequestStatus.failure,
          message: error.message,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          detailStatus: RequestStatus.failure,
          message: 'Could not connect to server. Please check your connection and try again.',
        ),
      );
    }
  }
}

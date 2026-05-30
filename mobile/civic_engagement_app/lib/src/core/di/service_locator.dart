import 'package:get_it/get_it.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/presentation/cubit/auth_cubit.dart';
import '../../features/citizen/data/repositories/citizen_repository_impl.dart';
import '../../features/citizen/domain/repositories/citizen_repository.dart';
import '../../features/citizen/presentation/cubit/history_cubit.dart';
import '../../features/citizen/presentation/cubit/notifications_cubit.dart';
import '../../features/citizen/presentation/cubit/policy_cubit.dart';
import '../../features/citizen/presentation/cubit/profile_cubit.dart';
import '../../features/citizen/presentation/cubit/vote_cubit.dart';
import '../config/app_config.dart';
import '../network/api_client.dart';
import '../services/notification_socket_service.dart';
import '../session/session_store.dart';

final serviceLocator = GetIt.instance;

Future<void> configureDependencies({bool reset = false}) async {
  if (reset) {
    await serviceLocator.reset();
  }

  if (serviceLocator.isRegistered<AuthRepository>()) return;

  final preferences = await SharedPreferences.getInstance();

  serviceLocator
    ..registerLazySingleton<SharedPreferences>(() => preferences)
    ..registerLazySingleton<http.Client>(http.Client.new)
    ..registerLazySingleton<SessionStore>(() => SessionStore(serviceLocator()))
    ..registerLazySingleton<ApiClient>(
      () => ApiClient(
        client: serviceLocator(),
        sessionStore: serviceLocator(),
        baseUrls: AppConfig.apiBaseUrls,
      ),
    )
    // NEW: Register WebSocket service for real-time notifications
    ..registerLazySingleton<NotificationSocketService>(
      NotificationSocketService.new,
    )
    ..registerLazySingleton<AuthRepository>(
      () => AuthRepositoryImpl(serviceLocator(), serviceLocator()),
    )
    ..registerLazySingleton<CitizenRepository>(
      () => CitizenRepositoryImpl(serviceLocator(), serviceLocator()),
    )
    ..registerFactory<AuthCubit>(
      () => AuthCubit(
        serviceLocator(),
        serviceLocator(),
      ),
    )
    ..registerFactory<ProfileCubit>(() => ProfileCubit(serviceLocator()))
    ..registerFactory<PolicyCubit>(() => PolicyCubit(serviceLocator()))
    ..registerFactory<VoteCubit>(() => VoteCubit(serviceLocator()))
    ..registerFactory<HistoryCubit>(() => HistoryCubit(serviceLocator()))
    // UPDATED: Pass socket service to NotificationsCubit
    ..registerFactory<NotificationsCubit>(
      () => NotificationsCubit(
        serviceLocator(),
        serviceLocator(),
      ),
    );
}

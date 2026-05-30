import 'package:flutter/material.dart';

import 'src/app/civic_app.dart';
import 'src/core/config/app_config.dart';
import 'src/core/di/service_locator.dart';
import 'src/core/network/network_test.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Run network tests in debug mode
  if (const bool.fromEnvironment('dart.vm.product') == false) {
    print('🚀 Starting network diagnostics...');
    print('📍 API Base URL: ${AppConfig.apiBaseUrl}');
    await NetworkTest.testConnection(AppConfig.apiBaseUrl);
    await NetworkTest.testApiEndpoint(AppConfig.apiBaseUrl);
    print('🏁 Network diagnostics complete\n');
  }
  
  await configureDependencies();
  runApp(const CivicApp());
}

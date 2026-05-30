import 'package:civic_engagement_app/src/app/civic_app.dart';
import 'package:civic_engagement_app/src/core/di/service_locator.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await configureDependencies(reset: true);
  });

  testWidgets('renders the citizen auth screen', (tester) async {
    await tester.pumpWidget(const CivicApp());
    await tester.pumpAndSettle();

    expect(find.text('Your Voice in\nAction'), findsOneWidget);
    expect(find.text('Get Started'), findsOneWidget);
    expect(find.text('Log In'), findsOneWidget);
    expect(find.text('Request planner access'), findsOneWidget);
  });
}

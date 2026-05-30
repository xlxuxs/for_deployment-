import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_button.dart';

class LandingPage extends StatelessWidget {
  const LandingPage({
    required this.onLogin,
    required this.onRegister,
    required this.onPlannerRequest,
    super.key,
  });

  final VoidCallback onLogin;
  final VoidCallback onRegister;
  final VoidCallback onPlannerRequest;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // Dynamic Soft ambient background highlights
          Positioned(
            top: -100,
            right: -150,
            child: Container(
              width: 500,
              height: 500,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.primary.withValues(alpha: 0.15),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -200,
            left: -150,
            child: Container(
              width: 600,
              height: 600,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.primary.withValues(alpha: 0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: IntrinsicHeight(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 28,
                        vertical: 32,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Spacer(flex: 3),
                          // Logo with elegant shadow and subtle border
                          Center(
                            child: Container(
                              width: 110,
                              height: 110,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(32),
                                border:
                                    Border.all(color: Colors.white, width: 4),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppTheme.primary.withValues(
                                      alpha: 0.25,
                                    ),
                                    blurRadius: 40,
                                    offset: const Offset(0, 20),
                                  ),
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.05),
                                    blurRadius: 10,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(28),
                                child: Image.asset(
                                  'assets/logo.png',
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 56),
                          // App Title
                          Text(
                            'Your Voice in\nAction',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.displaySmall?.copyWith(
                              fontWeight: FontWeight.w900,
                              color: AppTheme.text,
                              height: 1.1,
                              letterSpacing: -1.5,
                            ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Engage with local policies, submit feedback, and make a real impact directly from your device.',
                            textAlign: TextAlign.center,
                            style: theme.textTheme.bodyLarge?.copyWith(
                              color: AppTheme.mutedText,
                              fontWeight: FontWeight.w500,
                              height: 1.6,
                              letterSpacing: 0.2,
                            ),
                          ),
                          const Spacer(flex: 4),
                          // Actions
                          AppButton(
                            label: 'Get Started',
                            icon: Icons.rocket_launch_rounded,
                            onPressed: onRegister,
                          ),
                          const SizedBox(height: 16),
                          OutlinedButton(
                            onPressed: onLogin,
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(58),
                              side: BorderSide(
                                color: AppTheme.primary.withValues(alpha: 0.25),
                                width: 2,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                              backgroundColor: Colors.white,
                            ),
                            child: const Text(
                              'Log In',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          Center(
                            child: TextButton.icon(
                              onPressed: onPlannerRequest,
                              icon: const Icon(Icons.shield_outlined, size: 20),
                              label: const Text(
                                'Request planner access',
                                style: TextStyle(fontWeight: FontWeight.w700),
                              ),
                              style: TextButton.styleFrom(
                                foregroundColor: AppTheme.mutedText,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

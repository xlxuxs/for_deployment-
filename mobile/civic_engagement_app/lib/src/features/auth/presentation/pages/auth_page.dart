import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/services/location_service.dart';
import '../../domain/entities/user_demographics.dart';
import '../cubit/auth_cubit.dart';

enum _AuthMode { login, register, verify, reset }

class AuthPage extends StatefulWidget {
  const AuthPage({
    this.initialRegister = false,
    this.onBack,
    super.key,
  });

  final bool initialRegister;
  final VoidCallback? onBack;

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  late _AuthMode _mode;

  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _regionController = TextEditingController();
  final _captchaController = TextEditingController();
  final _otpController = TextEditingController();
  final _resetTokenController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _locationService = LocationService();
  bool _isDetectingLocation = false;

  // New: Demographic fields
  String? _selectedAgeRange;
  String? _selectedGender;
  String? _selectedOccupation;
  String? _selectedEducation;

  @override
  void initState() {
    super.initState();
    _mode = widget.initialRegister ? _AuthMode.register : _AuthMode.login;
    // Don't auto-detect on load - require user to explicitly enable GPS
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _regionController.dispose();
    _captchaController.dispose();
    _otpController.dispose();
    _resetTokenController.dispose();
    _newPasswordController.dispose();
    super.dispose();
  }

  Future<void> _detectLocation() async {
    setState(() => _isDetectingLocation = true);
    final region = await _locationService.getCurrentRegion();
    if (region != null && mounted) {
      _regionController.text = region;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('✅ Location detected: $region'),
          backgroundColor: Colors.green,
        ),
      );
    } else if (mounted) {
      _regionController.text = '';
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              '📱 Please enable location in settings, then return here and tap the location button again'),
          backgroundColor: Colors.orange,
          duration: Duration(seconds: 5),
        ),
      );
    }
    if (mounted) {
      setState(() => _isDetectingLocation = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AuthCubit, AuthState>(
      listener: (context, state) {
        if (state.status == AuthStatus.otpPending) {
          _emailController.text = state.email ?? _emailController.text;
          setState(() => _mode = _AuthMode.verify);
        }
        if (state.status == AuthStatus.passwordResetSuccess) {
          _resetTokenController.clear();
          _newPasswordController.clear();
          _passwordController.clear();
          setState(() => _mode = _AuthMode.login);
        }
        if (state.message != null &&
            state.status != AuthStatus.authenticated &&
            state.status != AuthStatus.loading) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text(state.message!)));
        }
      },
      builder: (context, state) {
        return Scaffold(
          body: SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 22, 20, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (widget.onBack != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: IconButton(
                        icon: const Icon(Icons.arrow_back_rounded),
                        onPressed: widget.onBack,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                      ),
                    ),
                  if (widget.onBack != null) const SizedBox(height: 16),
                  const _AuthHeader(),
                  const SizedBox(height: 26),
                  _ModeSelector(
                    mode: _mode,
                    onChanged: (mode) => setState(() => _mode = mode),
                  ),
                  const SizedBox(height: 16),
                  AppCard(
                    margin: EdgeInsets.zero,
                    padding: const EdgeInsets.all(18),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 180),
                      child: switch (_mode) {
                        _AuthMode.login => _LoginForm(
                            key: const ValueKey('login'),
                            emailController: _emailController,
                            passwordController: _passwordController,
                            captchaController: _captchaController,
                            loading: state.isBusy,
                            onSubmit: _login,
                          ),
                        _AuthMode.register => _RegisterForm(
                            key: const ValueKey('register'),
                            emailController: _emailController,
                            passwordController: _passwordController,
                            phoneController: _phoneController,
                            regionController: _regionController,
                            captchaController: _captchaController,
                            selectedAgeRange: _selectedAgeRange,
                            selectedGender: _selectedGender,
                            selectedOccupation: _selectedOccupation,
                            selectedEducation: _selectedEducation,
                            onAgeRangeChanged: (value) =>
                                setState(() => _selectedAgeRange = value),
                            onGenderChanged: (value) =>
                                setState(() => _selectedGender = value),
                            onOccupationChanged: (value) =>
                                setState(() => _selectedOccupation = value),
                            onEducationChanged: (value) =>
                                setState(() => _selectedEducation = value),
                            loading: state.isBusy,
                            isDetectingLocation: _isDetectingLocation,
                            onSubmit: _register,
                            onDetectLocation: _detectLocation,
                          ),
                        _AuthMode.verify => _VerifyForm(
                            key: const ValueKey('verify'),
                            emailController: _emailController,
                            otpController: _otpController,
                            loading: state.isBusy,
                            onVerify: _verifyOtp,
                            onResend: _sendOtp,
                          ),
                        _AuthMode.reset => _ResetForm(
                            key: const ValueKey('reset'),
                            emailController: _emailController,
                            tokenController: _resetTokenController,
                            newPasswordController: _newPasswordController,
                            loading: state.isBusy,
                            onRequest: _forgotPassword,
                            onReset: _resetPassword,
                          ),
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _login() {
    if (!_ensure(_emailController, 'Email is required') ||
        !_ensure(_passwordController, 'Password is required')) {
      return;
    }
    context.read<AuthCubit>().login(
          email: _emailController.text,
          password: _passwordController.text,
          captchaToken: _captchaController.text,
        );
  }

  void _register() {
    if (!_ensure(_emailController, 'Email is required') ||
        !_ensure(_passwordController, 'Password is required') ||
        !_ensure(_phoneController, 'Phone is required')) {
      return;
    }

    // Strict region validation - must be detected via GPS
    if (_regionController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
              '📍 Location is required. Please enable GPS and tap the location button.'),
          backgroundColor: Colors.red,
          duration: Duration(seconds: 4),
        ),
      );
      return;
    }

    // Validate demographic fields
    if (_selectedAgeRange == null) {
      _showError('Please select your age range');
      return;
    }
    if (_selectedGender == null) {
      _showError('Please select your gender');
      return;
    }
    if (_selectedOccupation == null) {
      _showError('Please select your occupation');
      return;
    }
    if (_selectedEducation == null) {
      _showError('Please select your education level');
      return;
    }

    context.read<AuthCubit>().register(
          email: _emailController.text,
          password: _passwordController.text,
          phone: _phoneController.text,
          region: _regionController.text,
          captchaToken: _captchaController.text,
          demographics: UserDemographics(
            ageRange: _selectedAgeRange!,
            gender: _selectedGender!,
            occupation: _selectedOccupation!,
            education: _selectedEducation!,
          ),
        );
  }

  void _verifyOtp() {
    if (!_ensure(_emailController, 'Email is required') ||
        !_ensure(_otpController, 'OTP code is required')) {
      return;
    }
    context.read<AuthCubit>().verifyOtp(
          email: _emailController.text,
          code: _otpController.text,
        );
  }

  void _sendOtp() {
    if (!_ensure(_emailController, 'Email is required')) return;
    context.read<AuthCubit>().sendOtp(_emailController.text);
  }

  void _forgotPassword() {
    if (!_ensure(_emailController, 'Email is required')) return;
    context.read<AuthCubit>().forgotPassword(_emailController.text);
  }

  void _resetPassword() {
    if (!_ensure(_resetTokenController, 'Reset token is required') ||
        !_ensure(_newPasswordController, 'New password is required')) {
      return;
    }
    context.read<AuthCubit>().resetPassword(
          token: _resetTokenController.text,
          newPassword: _newPasswordController.text,
        );
  }

  bool _ensure(TextEditingController controller, String message) {
    if (controller.text.trim().isNotEmpty) return true;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
    return false;
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red,
      ),
    );
  }
}

class _AuthHeader extends StatelessWidget {
  const _AuthHeader();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primary.withValues(alpha: 0.25),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: Image.asset('assets/logo.png', fit: BoxFit.cover),
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'Civic Voice',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                fontWeight: FontWeight.w900,
                color: AppTheme.text,
                letterSpacing: -0.5,
              ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Review active public policies, vote once, and track your feedback.',
          textAlign: TextAlign.center,
          style:
              TextStyle(color: AppTheme.mutedText, fontSize: 16, height: 1.4),
        ),
      ],
    );
  }
}

class _ModeSelector extends StatelessWidget {
  const _ModeSelector({required this.mode, required this.onChanged});

  final _AuthMode mode;
  final ValueChanged<_AuthMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        runSpacing: 10,
        children: [
          _chip('Login', _AuthMode.login),
          _chip('Register', _AuthMode.register),
          _chip('Verify OTP', _AuthMode.verify),
          _chip('Reset', _AuthMode.reset),
        ],
      ),
    );
  }

  Widget _chip(String label, _AuthMode value) {
    final selected = mode == value;
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onChanged(value),
      selectedColor: AppTheme.primary.withValues(alpha: 0.14),
      labelStyle: TextStyle(
        color: selected ? AppTheme.primary : AppTheme.mutedText,
        fontWeight: FontWeight.w800,
      ),
      side: BorderSide(
        color: selected ? AppTheme.primary : const Color(0xFFE5EDF3),
      ),
      showCheckmark: false,
    );
  }
}

class _LoginForm extends StatelessWidget {
  const _LoginForm({
    required this.emailController,
    required this.passwordController,
    required this.captchaController,
    required this.loading,
    required this.onSubmit,
    super.key,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;
  final TextEditingController captchaController;
  final bool loading;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: key,
      children: [
        AppTextField(
          controller: emailController,
          label: 'Email',
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 12),
        AppTextField(
          controller: passwordController,
          label: 'Password',
          icon: Icons.lock_outline_rounded,
          obscureText: true,
        ),
        const SizedBox(height: 12),
        AppTextField(
          controller: captchaController,
          label: 'CAPTCHA token',
          hint: 'Required only when enabled by the server',
          icon: Icons.security_rounded,
        ),
        const SizedBox(height: 18),
        AppButton(
          label: 'Login',
          icon: Icons.login_rounded,
          loading: loading,
          onPressed: onSubmit,
        ),
      ],
    );
  }
}

class _RegisterForm extends StatelessWidget {
  const _RegisterForm({
    required this.emailController,
    required this.passwordController,
    required this.phoneController,
    required this.regionController,
    required this.captchaController,
    required this.selectedAgeRange,
    required this.selectedGender,
    required this.selectedOccupation,
    required this.selectedEducation,
    required this.onAgeRangeChanged,
    required this.onGenderChanged,
    required this.onOccupationChanged,
    required this.onEducationChanged,
    required this.loading,
    required this.isDetectingLocation,
    required this.onSubmit,
    required this.onDetectLocation,
    super.key,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;
  final TextEditingController phoneController;
  final TextEditingController regionController;
  final TextEditingController captchaController;
  final String? selectedAgeRange;
  final String? selectedGender;
  final String? selectedOccupation;
  final String? selectedEducation;
  final ValueChanged<String?> onAgeRangeChanged;
  final ValueChanged<String?> onGenderChanged;
  final ValueChanged<String?> onOccupationChanged;
  final ValueChanged<String?> onEducationChanged;
  final bool loading;
  final bool isDetectingLocation;
  final VoidCallback onSubmit;
  final VoidCallback onDetectLocation;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: key,
      children: [
        AppTextField(
          controller: emailController,
          label: 'Email',
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        AppTextField(
          controller: passwordController,
          label: 'Password',
          icon: Icons.lock_outline_rounded,
          obscureText: true,
        ),
        const SizedBox(height: 12),
        AppTextField(
          controller: phoneController,
          label: 'Phone',
          hint: '+251912345678',
          icon: Icons.phone_iphone_rounded,
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 12),
        AppTextField(
          controller: captchaController,
          label: 'CAPTCHA token',
          hint: 'Required only when enabled by the server',
          icon: Icons.security_rounded,
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppTheme.primary.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: AppTheme.primary.withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.location_on,
                    color: AppTheme.primary,
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Location Verification',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'For security, we verify your region using GPS. Please enable location services.',
                style: TextStyle(
                  fontSize: 12,
                  color: AppTheme.mutedText,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: AppTextField(
                      controller: regionController,
                      label: 'Detected Region',
                      icon: Icons.map_outlined,
                      readOnly: true,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: IconButton(
                      onPressed: isDetectingLocation ? null : onDetectLocation,
                      icon: isDetectingLocation
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.my_location, color: Colors.white),
                      tooltip: 'Detect my location',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Demographic Information Section
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.blue.shade50,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.blue.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.person_outline,
                      color: Colors.blue.shade700, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Demographic Information',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.blue.shade700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'This helps us understand community needs better.',
                style: TextStyle(fontSize: 12, color: AppTheme.mutedText),
              ),
              const SizedBox(height: 12),
              _DemographicDropdown(
                label: 'Age Range',
                icon: Icons.cake_outlined,
                value: selectedAgeRange,
                items: AgeRange.all,
                getLabel: AgeRange.getLabel,
                onChanged: onAgeRangeChanged,
              ),
              const SizedBox(height: 12),
              _DemographicDropdown(
                label: 'Gender',
                icon: Icons.wc_outlined,
                value: selectedGender,
                items: Gender.all,
                getLabel: Gender.getLabel,
                onChanged: onGenderChanged,
              ),
              const SizedBox(height: 12),
              _DemographicDropdown(
                label: 'Occupation',
                icon: Icons.work_outline,
                value: selectedOccupation,
                items: Occupation.all,
                getLabel: Occupation.getLabel,
                onChanged: onOccupationChanged,
              ),
              const SizedBox(height: 12),
              _DemographicDropdown(
                label: 'Education Level',
                icon: Icons.school_outlined,
                value: selectedEducation,
                items: Education.all,
                getLabel: Education.getLabel,
                onChanged: onEducationChanged,
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        AppButton(
          label: 'Create account',
          icon: Icons.person_add_alt_1_rounded,
          loading: loading,
          onPressed: onSubmit,
        ),
      ],
    );
  }
}

class _VerifyForm extends StatelessWidget {
  const _VerifyForm({
    required this.emailController,
    required this.otpController,
    required this.loading,
    required this.onVerify,
    required this.onResend,
    super.key,
  });

  final TextEditingController emailController;
  final TextEditingController otpController;
  final bool loading;
  final VoidCallback onVerify;
  final VoidCallback onResend;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: key,
      children: [
        AppTextField(
          controller: emailController,
          label: 'Email',
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        AppTextField(
          controller: otpController,
          label: '6-digit OTP',
          icon: Icons.pin_outlined,
          keyboardType: TextInputType.number,
          maxLength: 6,
        ),
        const SizedBox(height: 12),
        AppButton(
          label: 'Verify and continue',
          icon: Icons.verified_user_outlined,
          loading: loading,
          onPressed: onVerify,
        ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: loading ? null : onResend,
          icon: const Icon(Icons.refresh_rounded),
          label: const Text('Send OTP again'),
        ),
      ],
    );
  }
}

class _ResetForm extends StatelessWidget {
  const _ResetForm({
    required this.emailController,
    required this.tokenController,
    required this.newPasswordController,
    required this.loading,
    required this.onRequest,
    required this.onReset,
    super.key,
  });

  final TextEditingController emailController;
  final TextEditingController tokenController;
  final TextEditingController newPasswordController;
  final bool loading;
  final VoidCallback onRequest;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: key,
      children: [
        AppTextField(
          controller: emailController,
          label: 'Email',
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: loading ? null : onRequest,
          icon: const Icon(Icons.mark_email_read_outlined),
          label: const Text('Request reset email'),
        ),
        const SizedBox(height: 16),
        AppTextField(
          controller: tokenController,
          label: 'Reset token',
          icon: Icons.key_rounded,
        ),
        const SizedBox(height: 12),
        AppTextField(
          controller: newPasswordController,
          label: 'New password',
          icon: Icons.lock_reset_rounded,
          obscureText: true,
        ),
        const SizedBox(height: 18),
        AppButton(
          label: 'Reset password',
          icon: Icons.save_rounded,
          loading: loading,
          onPressed: onReset,
        ),
      ],
    );
  }
}

// New: Demographic dropdown widget
class _DemographicDropdown extends StatelessWidget {
  const _DemographicDropdown({
    required this.label,
    required this.icon,
    required this.value,
    required this.items,
    required this.getLabel,
    required this.onChanged,
  });

  final String label;
  final IconData icon;
  final String? value;
  final List<String> items;
  final String Function(String) getLabel;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5EDF3)),
      ),
      child: DropdownButtonFormField<String>(
        value: value,
        decoration: InputDecoration(
          labelText: label,
          prefixIcon: Icon(icon, color: AppTheme.primary),
          border: InputBorder.none,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
        items: items.map((item) {
          return DropdownMenuItem(
            value: item,
            child: Text(getLabel(item)),
          );
        }).toList(),
        onChanged: onChanged,
        dropdownColor: Colors.white,
        style: const TextStyle(color: AppTheme.text, fontSize: 16),
      ),
    );
  }
}

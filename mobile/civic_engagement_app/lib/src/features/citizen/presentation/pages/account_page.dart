import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/state/request_status.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/error_view.dart';
import '../../../../core/services/location_service.dart';
import '../../../auth/presentation/cubit/auth_cubit.dart';
import '../cubit/profile_cubit.dart';
import 'planner_request_page.dart';

class AccountPage extends StatefulWidget {
  const AccountPage({super.key});

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  final _regionController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _newEmailController = TextEditingController();
  final _emailCodeController = TextEditingController();
  final _newPhoneController = TextEditingController();
  final _phoneCodeController = TextEditingController();
  final _locationService = LocationService();
  bool _isDetectingLocation = false;
  bool _logoutAfterPhoneVerify = false;
  String _selectedLanguage = 'en';

  @override
  void dispose() {
    _regionController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _newEmailController.dispose();
    _emailCodeController.dispose();
    _newPhoneController.dispose();
    _phoneCodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ProfileCubit, ProfileState>(
      listenWhen: (previous, current) =>
          previous.actionStatus != current.actionStatus ||
          previous.profile != current.profile,
      listener: (context, state) {
        if (state.profile != null &&
            _regionController.text != state.profile!.region) {
          _regionController.text = state.profile!.region;
        }
        if (state.profile != null &&
            _selectedLanguage != state.profile!.preferredLanguage) {
          _selectedLanguage = state.profile!.preferredLanguage;
        }
        if (state.actionStatus == RequestStatus.success &&
            state.message != null) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(
              content: Text(state.message!),
              backgroundColor: Colors.green.shade600));
          _currentPasswordController.clear();
          _newPasswordController.clear();
          _emailCodeController.clear();
          _phoneCodeController.clear();
          if (_logoutAfterPhoneVerify) {
            _logoutAfterPhoneVerify = false;
            context.read<AuthCubit>().logout();
          }
        }
        if (state.actionStatus == RequestStatus.failure &&
            state.message != null) {
          _logoutAfterPhoneVerify = false;
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(
              content: Text(state.message!),
              backgroundColor: Colors.redAccent));
        }
      },
      builder: (context, state) {
        return Scaffold(
          appBar: AppBar(
            title: const Text('Account'),
            actions: [
              IconButton(
                tooltip: 'Refresh',
                onPressed: () => context.read<ProfileCubit>().loadProfile(),
                icon: const Icon(Icons.refresh_rounded),
              ),
              const SizedBox(width: 8),
            ],
          ),
          body: _body(context, state),
        );
      },
    );
  }

  Widget _body(BuildContext context, ProfileState state) {
    if (state.status == RequestStatus.loading && state.profile == null) {
      return const Center(
          child: CircularProgressIndicator(color: AppTheme.primary));
    }

    if (state.status == RequestStatus.failure && state.profile == null) {
      return ErrorView(
        message: state.message ?? 'Failed to load profile.',
        onRetry: () => context.read<ProfileCubit>().loadProfile(),
      );
    }

    final profile = state.profile;
    if (profile == null) {
      return const Center(
          child: CircularProgressIndicator(color: AppTheme.primary));
    }

    final busy = state.actionStatus == RequestStatus.loading;

    return RefreshIndicator(
      color: AppTheme.primary,
      backgroundColor: Colors.white,
      onRefresh: () => context.read<ProfileCubit>().loadProfile(),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          AppCard(
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.person_rounded,
                    color: AppTheme.primary,
                    size: 28,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile.email,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.location_on_rounded,
                              size: 14,
                              color: AppTheme.mutedText.withValues(alpha: 0.8)),
                          const SizedBox(width: 4),
                          Text(
                            profile.region,
                            style: const TextStyle(
                                color: AppTheme.mutedText,
                                fontWeight: FontWeight.w600,
                                fontSize: 13),
                          ),
                          const SizedBox(width: 8),
                          if (profile.verified) ...[
                            Icon(Icons.verified_rounded,
                                size: 14, color: Colors.blue.shade600),
                            const SizedBox(width: 2),
                            Text('Verified',
                                style: TextStyle(
                                    color: Colors.blue.shade600,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13)),
                          ] else ...[
                            Icon(Icons.pending_actions_rounded,
                                size: 14, color: Colors.orange.shade600),
                            const SizedBox(width: 2),
                            Text('Unverified',
                                style: TextStyle(
                                    color: Colors.orange.shade600,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13)),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                  icon: Icons.translate_rounded,
                  title: 'Language',
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _selectedLanguage,
                  decoration: const InputDecoration(
                    labelText: 'Preferred translation language',
                    prefixIcon: Icon(Icons.language_rounded),
                  ),
                  icon: const Icon(Icons.keyboard_arrow_down_rounded),
                  items: const [
                    DropdownMenuItem(value: 'en', child: Text('English')),
                    DropdownMenuItem(value: 'am', child: Text('Amharic')),
                    DropdownMenuItem(value: 'om', child: Text('Oromo')),
                    DropdownMenuItem(value: 'ti', child: Text('Tigrinya')),
                  ],
                  onChanged: busy
                      ? null
                      : (value) {
                          if (value == null || value == _selectedLanguage) {
                            return;
                          }
                          setState(() => _selectedLanguage = value);
                          context
                              .read<ProfileCubit>()
                              .updatePreferredLanguage(value);
                        },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                  icon: Icons.work_outline_rounded,
                  title: 'Become a Planner',
                ),
                const SizedBox(height: 12),
                const Text(
                  'Planners can create and manage policy proposals. Apply to become a planner if you work in policy development.',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.mutedText,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (context) => const PlannerRequestPage(),
                      ),
                    );
                  },
                  icon: const Icon(Icons.send_rounded),
                  label: const Text('Request Planner Status'),
                  style: _outlinedButtonStyle(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                  icon: Icons.phone_iphone_rounded,
                  title: 'Phone change',
                ),
                const SizedBox(height: 16),
                AppTextField(
                  controller: _newPhoneController,
                  label: 'New phone',
                  hint: '+251912345678',
                  icon: Icons.phone_iphone_rounded,
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: busy ? null : _requestPhoneChange,
                  icon: const Icon(Icons.sms_rounded),
                  label: const Text('Send phone OTP'),
                  style: _outlinedButtonStyle(),
                ),
                const SizedBox(height: 16),
                AppTextField(
                  controller: _phoneCodeController,
                  label: 'Phone OTP',
                  icon: Icons.pin_outlined,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                ),
                const SizedBox(height: 12),
                AppButton(
                  label: 'Verify phone',
                  icon: Icons.verified_rounded,
                  loading: busy,
                  onPressed: _verifyPhoneChange,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                  icon: Icons.download_rounded,
                  title: 'Data export',
                ),
                const SizedBox(height: 12),
                const Text(
                  'Download your profile, votes, comments, notifications, messages, and planner requests as JSON.',
                  style: TextStyle(
                    fontSize: 14,
                    color: AppTheme.mutedText,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: busy
                      ? null
                      : () => context.read<ProfileCubit>().exportUserData(),
                  icon: const Icon(Icons.file_download_outlined),
                  label: const Text('Export my data'),
                  style: _outlinedButtonStyle(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                  icon: Icons.location_on_rounded,
                  title: 'Region Update',
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.03),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: AppTheme.primary.withValues(alpha: 0.15),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            Icons.security_rounded,
                            color: AppTheme.primary,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          const Text(
                            'GPS Verification Required',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'For security, region updates require GPS verification. Enable location services and tap the button below.',
                        style: TextStyle(
                          fontSize: 13,
                          color: AppTheme.primary.withValues(alpha: 0.8),
                          height: 1.4,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: AppTextField(
                              controller: _regionController,
                              label: 'Current Region',
                              icon: Icons.map_rounded,
                              readOnly: true,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Container(
                            height: 56, // Match text field height
                            width: 56,
                            decoration: BoxDecoration(
                              color: AppTheme.primary,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: [
                                BoxShadow(
                                  color:
                                      AppTheme.primary.withValues(alpha: 0.3),
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
                                )
                              ],
                            ),
                            child: IconButton(
                              onPressed:
                                  _isDetectingLocation ? null : _detectLocation,
                              icon: _isDetectingLocation
                                  ? const SizedBox(
                                      width: 24,
                                      height: 24,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.5,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(Icons.my_location_rounded,
                                      color: Colors.white),
                              tooltip: 'Detect my location',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                  icon: Icons.lock_outline_rounded,
                  title: 'Password',
                ),
                const SizedBox(height: 16),
                AppTextField(
                  controller: _currentPasswordController,
                  label: 'Current password',
                  icon: Icons.lock_outline_rounded,
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                AppTextField(
                  controller: _newPasswordController,
                  label: 'New password',
                  icon: Icons.lock_reset_rounded,
                  obscureText: true,
                ),
                const SizedBox(height: 16),
                AppButton(
                  label: 'Change password',
                  icon: Icons.password_rounded,
                  loading: busy,
                  onPressed: _changePassword,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                  icon: Icons.alternate_email_rounded,
                  title: 'Email change',
                ),
                const SizedBox(height: 16),
                AppTextField(
                  controller: _newEmailController,
                  label: 'New email',
                  icon: Icons.mail_outline_rounded,
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: busy ? null : _requestEmailChange,
                  icon: const Icon(Icons.mark_email_read_outlined),
                  label: const Text('Send verification code'),
                  style: _outlinedButtonStyle(),
                ),
                const SizedBox(height: 16),
                AppTextField(
                  controller: _emailCodeController,
                  label: 'Verification code',
                  icon: Icons.pin_outlined,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                ),
                const SizedBox(height: 12),
                AppButton(
                  label: 'Verify email',
                  icon: Icons.verified_rounded,
                  loading: busy,
                  onPressed: _verifyEmailChange,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SectionTitle(
                    icon: Icons.logout_rounded, title: 'Session'),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () => context.read<AuthCubit>().logout(),
                  icon: const Icon(Icons.logout_rounded),
                  label: const Text('Logout'),
                  style: _outlinedButtonStyle(),
                ),
                const SizedBox(height: 12),
                TextButton.icon(
                  onPressed: busy ? null : () => _confirmDelete(context),
                  icon: const Icon(Icons.delete_forever_rounded),
                  label: const Text('Delete account'),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.redAccent,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  ButtonStyle _outlinedButtonStyle() {
    return OutlinedButton.styleFrom(
      foregroundColor: AppTheme.primary,
      side: BorderSide(color: AppTheme.primary.withValues(alpha: 0.3)),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
    );
  }

  void _changePassword() {
    if (_currentPasswordController.text.trim().isEmpty ||
        _newPasswordController.text.trim().isEmpty) {
      _showMessage('Current and new password are required.', isError: true);
      return;
    }
    context.read<ProfileCubit>().changePassword(
          currentPassword: _currentPasswordController.text,
          newPassword: _newPasswordController.text,
        );
  }

  void _requestEmailChange() {
    if (_newEmailController.text.trim().isEmpty) {
      _showMessage('New email is required.', isError: true);
      return;
    }
    context.read<ProfileCubit>().requestEmailChange(_newEmailController.text);
  }

  void _verifyEmailChange() {
    if (_emailCodeController.text.trim().isEmpty) {
      _showMessage('Verification code is required.', isError: true);
      return;
    }
    context.read<ProfileCubit>().verifyEmailChange(_emailCodeController.text);
  }

  void _requestPhoneChange() {
    if (_newPhoneController.text.trim().isEmpty) {
      _showMessage('New phone is required.', isError: true);
      return;
    }
    context.read<ProfileCubit>().requestPhoneChange(_newPhoneController.text);
  }

  void _verifyPhoneChange() {
    if (_newPhoneController.text.trim().isEmpty ||
        _phoneCodeController.text.trim().isEmpty) {
      _showMessage('New phone and OTP are required.', isError: true);
      return;
    }
    _logoutAfterPhoneVerify = true;
    context.read<ProfileCubit>().verifyPhoneChange(
          newPhone: _newPhoneController.text,
          code: _phoneCodeController.text,
        );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: const Text('Delete account?',
            style: TextStyle(fontWeight: FontWeight.w800)),
        content: const Text(
          'Your account will be anonymized and deactivated. This cannot be undone.',
          style: TextStyle(color: AppTheme.mutedText),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: TextButton.styleFrom(foregroundColor: Colors.redAccent),
            child: const Text('Delete',
                style: TextStyle(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;
    final error = await context.read<ProfileCubit>().deleteAccount();
    if (!context.mounted || error != null) return;
    context.read<AuthCubit>().logout();
  }

  void _showMessage(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.redAccent : null,
      ),
    );
  }

  Future<void> _detectLocation() async {
    setState(() => _isDetectingLocation = true);
    final region = await _locationService.getCurrentRegion();
    if (region != null && mounted) {
      final oldRegion = _regionController.text;
      _regionController.text = region;

      // Automatically update region after detection
      if (oldRegion != region) {
        context.read<ProfileCubit>().updateRegion(region);
        _showMessage('Location detected and updated: $region');
      } else {
        _showMessage('Location detected: $region (no change)');
      }
    } else if (mounted) {
      _showMessage(
        'Please enable location in settings, then return and tap the location button again',
        isError: true,
      );
    }
    if (mounted) {
      setState(() => _isDetectingLocation = false);
    }
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: AppTheme.primary, size: 22),
        const SizedBox(width: 8),
        Text(
          title,
          style: Theme.of(
            context,
          )
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w900, fontSize: 18),
        ),
      ],
    );
  }
}

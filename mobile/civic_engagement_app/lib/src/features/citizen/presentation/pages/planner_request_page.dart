import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/di/service_locator.dart';
import '../../../../core/services/location_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_card.dart';
import '../../../auth/domain/repositories/auth_repository.dart';
import '../../domain/repositories/citizen_repository.dart';
import '../cubit/planner_request_cubit.dart';
import '../cubit/planner_request_state.dart';
import '../cubit/profile_cubit.dart';

class PlannerRequestPage extends StatelessWidget {
  const PlannerRequestPage({super.key});

  static const routeName = '/planner-request';

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (context) => PlannerRequestCubit(
        serviceLocator<CitizenRepository>(),
      ),
      child: const _PlannerRequestView(),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      color: Colors.white,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: AppTheme.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.assignment_turned_in_outlined,
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
                  'Apply to become a policy planner',
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Submit your applicant details, verified region, reason, and optional proof document for review.',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: AppTheme.mutedText,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
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
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w900,
              ),
        ),
      ],
    );
  }
}

class _RegionVerifier extends StatelessWidget {
  const _RegionVerifier({
    required this.controller,
    required this.isLoading,
    required this.isDetectingLocation,
    required this.regionResolved,
    required this.onDetectLocation,
  });

  final TextEditingController controller;
  final bool isLoading;
  final bool isDetectingLocation;
  final bool regionResolved;
  final VoidCallback onDetectLocation;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: regionResolved
              ? AppTheme.primary.withValues(alpha: 0.25)
              : Colors.orange.withValues(alpha: 0.35),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                regionResolved
                    ? Icons.verified_user_outlined
                    : Icons.location_searching_rounded,
                color: regionResolved ? AppTheme.primary : Colors.orange,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                regionResolved ? 'Region verified' : 'Region verification',
                style: TextStyle(
                  color: regionResolved ? AppTheme.primary : Colors.orange,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: controller,
                  readOnly: true,
                  decoration: const InputDecoration(
                    labelText: 'Region *',
                    prefixIcon: Icon(Icons.map_outlined),
                  ),
                  validator: (value) {
                    if ((value ?? '').trim().isEmpty) {
                      return 'Verify your region before submitting';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: 10),
              SizedBox(
                width: 56,
                height: 56,
                child: FilledButton(
                  onPressed: isLoading || isDetectingLocation
                      ? null
                      : onDetectLocation,
                  style: FilledButton.styleFrom(
                    padding: EdgeInsets.zero,
                    backgroundColor: AppTheme.primary,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                  ),
                  child: isDetectingLocation
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.my_location_rounded),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PlannerRequestView extends StatefulWidget {
  const _PlannerRequestView();

  @override
  State<_PlannerRequestView> createState() => _PlannerRequestViewState();
}

class _PlannerRequestViewState extends State<_PlannerRequestView> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _regionController = TextEditingController();
  final _organizationController = TextEditingController();
  final _reasonController = TextEditingController();
  final _locationService = LocationService();
  late final bool _hasSession;
  String _applicantType = 'nonCitizen';
  Uint8List? _proofFileBytes;
  String? _proofFileName;
  String? _proofFileMimeType;
  bool _didPrefillProfile = false;
  bool _isDetectingLocation = false;
  bool _regionResolved = false;

  @override
  void initState() {
    super.initState();
    _hasSession = serviceLocator<AuthRepository>().restoreSession() != null;
    if (_hasSession) {
      _applicantType = 'citizen';
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didPrefillProfile) return;
    _didPrefillProfile = true;
    _prefillFromProfile();
  }

  @override
  void dispose() {
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _regionController.dispose();
    _organizationController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  void _submitRequest() {
    if (!_regionResolved || _regionController.text.trim().isEmpty) {
      _showSnack(
        'Please verify your region with location before submitting.',
        isError: true,
      );
      return;
    }

    if (_formKey.currentState?.validate() ?? false) {
      context.read<PlannerRequestCubit>().submitRequest(
            organization: _organizationController.text.trim().isEmpty
                ? null
                : _organizationController.text.trim(),
            reason: _reasonController.text.trim(),
            applicantType: _applicantType,
            fullName: _fullNameController.text.trim(),
            email: _emailController.text.trim(),
            phone: _phoneController.text.trim(),
            region: _regionController.text.trim(),
            proofFileBase64:
                _proofFileBytes == null ? null : base64Encode(_proofFileBytes!),
            proofFileName: _proofFileName,
            proofFileMimeType: _proofFileMimeType,
          );
    }
  }

  Future<void> _prefillFromProfile() async {
    if (!_hasSession) return;

    try {
      final profile = context.read<ProfileCubit>().state.profile;
      if (profile != null) {
        _fullNameController.text = profile.fullName ?? _fullNameController.text;
        _emailController.text = profile.email;
        _phoneController.text = profile.phone ?? _phoneController.text;
        _regionController.text = profile.region;
        _regionResolved = profile.region.trim().isNotEmpty;
        if (mounted) setState(() {});
        return;
      }
    } catch (_) {
      // The page can also be opened before login, where ProfileCubit is absent.
    }

    try {
      final profile = await serviceLocator<CitizenRepository>().getProfile();
      if (!mounted) return;
      setState(() {
        _fullNameController.text = profile.fullName ?? _fullNameController.text;
        _emailController.text = profile.email;
        _phoneController.text = profile.phone ?? _phoneController.text;
        _regionController.text = profile.region;
        _regionResolved = profile.region.trim().isNotEmpty;
      });
    } catch (_) {
      // Profile prefill is best effort; validation still protects submission.
    }
  }

  Future<void> _detectLocation() async {
    setState(() => _isDetectingLocation = true);
    final region = await _locationService.getCurrentRegion();
    if (!mounted) return;

    if (region != null && region.trim().isNotEmpty) {
      setState(() {
        _regionController.text = region.trim();
        _regionResolved = true;
      });
      _showSnack('Location verified: ${region.trim()}');
    } else {
      setState(() => _regionResolved = false);
      _showSnack(
        'Please enable location access, then tap verify region again.',
        isError: true,
      );
    }

    if (mounted) {
      setState(() => _isDetectingLocation = false);
    }
  }

  Future<void> _pickProofFile() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'png', 'jpg', 'jpeg'],
    );

    final file = result?.files.single;
    if (file == null) return;
    if (file.bytes == null) {
      _showSnack('Could not read the selected file.', isError: true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      _showSnack('Proof file must be 5 MB or smaller.', isError: true);
      return;
    }

    setState(() {
      _proofFileBytes = file.bytes;
      _proofFileName = file.name;
      _proofFileMimeType = _mimeTypeFor(file.extension);
    });
  }

  void _removeProofFile() {
    setState(() {
      _proofFileBytes = null;
      _proofFileName = null;
      _proofFileMimeType = null;
    });
  }

  void _showSnack(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.redAccent : null,
      ),
    );
  }

  String _mimeTypeFor(String? extension) {
    switch (extension?.toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Request Planner Status'),
      ),
      body: BlocConsumer<PlannerRequestCubit, PlannerRequestState>(
        listener: (context, state) {
          if (state is PlannerRequestSuccess) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Colors.green.shade600,
              ),
            );
            Navigator.of(context).pop();
          } else if (state is PlannerRequestError) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.message),
                backgroundColor: Colors.redAccent,
              ),
            );
          }
        },
        builder: (context, state) {
          final isLoading = state is PlannerRequestLoading;

          return SingleChildScrollView(
            padding:
                const EdgeInsets.symmetric(horizontal: 24.0, vertical: 20.0),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _HeaderCard(theme: theme),
                  if (!_hasSession) ...[
                    const SizedBox(height: 16),
                    AppCard(
                      child: DropdownButtonFormField<String>(
                        value: _applicantType,
                        decoration: const InputDecoration(
                          labelText: 'I am applying as',
                          prefixIcon: Icon(Icons.assignment_ind_outlined),
                        ),
                        icon: const Icon(Icons.keyboard_arrow_down_rounded),
                        items: const [
                          DropdownMenuItem(
                            value: 'nonCitizen',
                            child: Text('Not a registered citizen'),
                          ),
                          DropdownMenuItem(
                            value: 'citizen',
                            child: Text('Registered citizen, not logged in'),
                          ),
                        ],
                        onChanged: isLoading
                            ? null
                            : (value) {
                                if (value != null) {
                                  setState(() => _applicantType = value);
                                }
                              },
                      ),
                    ),
                  ],
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _SectionTitle(
                          icon: Icons.badge_outlined,
                          title: 'Applicant details',
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _fullNameController,
                          decoration: const InputDecoration(
                            labelText: 'Full name *',
                            prefixIcon: Icon(Icons.person_outline_rounded),
                          ),
                          enabled: !isLoading,
                          maxLength: 100,
                          validator: (value) {
                            if ((value ?? '').trim().isEmpty) {
                              return 'Full name is required';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _emailController,
                          decoration: const InputDecoration(
                            labelText: 'Email *',
                            prefixIcon: Icon(Icons.email_outlined),
                          ),
                          keyboardType: TextInputType.emailAddress,
                          enabled: !isLoading,
                          validator: (value) {
                            final trimmed = (value ?? '').trim();
                            if (trimmed.isEmpty) return 'Email is required';
                            if (!trimmed.contains('@')) {
                              return 'Enter a valid email';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _phoneController,
                          decoration: const InputDecoration(
                            labelText: 'Phone *',
                            hintText: '+251912345678',
                            prefixIcon: Icon(Icons.phone_outlined),
                          ),
                          keyboardType: TextInputType.phone,
                          enabled: !isLoading,
                          validator: (value) {
                            if ((value ?? '').trim().isEmpty) {
                              return 'Phone is required';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        _RegionVerifier(
                          controller: _regionController,
                          isLoading: isLoading,
                          isDetectingLocation: _isDetectingLocation,
                          regionResolved: _regionResolved,
                          onDetectLocation: _detectLocation,
                        ),
                      ],
                    ),
                  ),
                  AppCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const _SectionTitle(
                          icon: Icons.work_outline_rounded,
                          title: 'Planner request',
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _organizationController,
                          decoration: const InputDecoration(
                            labelText: 'Organization (Optional)',
                            hintText: 'e.g., Ministry of Education',
                            prefixIcon: Icon(Icons.business_outlined),
                            helperText:
                                'Name of your affiliated organization, if any',
                          ),
                          enabled: !isLoading,
                          maxLength: 100,
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _reasonController,
                          decoration: const InputDecoration(
                            labelText: 'Reason *',
                            hintText:
                                'Explain why you need planner privileges...',
                            alignLabelWithHint: true,
                            helperText: 'Minimum 50 characters required',
                          ),
                          maxLines: 5,
                          maxLength: 500,
                          enabled: !isLoading,
                          validator: (value) {
                            final trimmed = value?.trim() ?? '';
                            if (trimmed.isEmpty) {
                              return 'Please provide a reason';
                            }
                            if (trimmed.length < 50) {
                              return 'Reason must be at least 50 characters (${trimmed.length}/50)';
                            }
                            return null;
                          },
                        ),
                      ],
                    ),
                  ),
                  AppCard(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        Icon(
                          _proofFileBytes == null
                              ? Icons.attach_file_rounded
                              : Icons.description_outlined,
                          color: theme.colorScheme.primary,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            _proofFileName ?? 'Attach proof document',
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        if (_proofFileBytes != null)
                          IconButton(
                            tooltip: 'Remove file',
                            onPressed: isLoading ? null : _removeProofFile,
                            icon: const Icon(Icons.close_rounded),
                          ),
                        TextButton.icon(
                          onPressed: isLoading ? null : _pickProofFile,
                          icon: const Icon(Icons.upload_file_rounded),
                          label: Text(
                            _proofFileBytes == null ? 'Upload' : 'Replace',
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),
                  AppButton(
                    label: 'Submit Request',
                    icon: Icons.send_rounded,
                    loading: isLoading,
                    onPressed: _submitRequest,
                  ),
                  const SizedBox(height: 24),
                  if (state is PlannerRequestError &&
                      state.code == 'DUPLICATE_ENTRY')
                    AppCard(
                      color: Colors.orange.shade50,
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          Icon(
                            Icons.info_outline_rounded,
                            color: Colors.orange.shade800,
                            size: 28,
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Text(
                              'You already have a pending request. Please wait for admin review.',
                              style: TextStyle(
                                color: Colors.orange.shade900,
                                fontWeight: FontWeight.w600,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (state is PlannerRequestError &&
                      state.code == 'RATE_LIMIT_EXCEEDED')
                    AppCard(
                      color: Colors.red.shade50,
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          Icon(
                            Icons.timer_outlined,
                            color: Colors.red.shade800,
                            size: 28,
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Text(
                              'You can only submit one request per day. Please try again later.',
                              style: TextStyle(
                                color: Colors.red.shade900,
                                fontWeight: FontWeight.w600,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

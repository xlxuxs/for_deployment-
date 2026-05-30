import 'package:flutter/material.dart';

class AppTextField extends StatefulWidget {
  const AppTextField({
    required this.controller,
    required this.label,
    super.key,
    this.hint,
    this.icon,
    this.keyboardType,
    this.obscureText = false,
    this.maxLines = 1,
    this.maxLength,
    this.textInputAction,
    this.readOnly = false,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final IconData? icon;
  final TextInputType? keyboardType;
  final bool obscureText;
  final int maxLines;
  final int? maxLength;
  final TextInputAction? textInputAction;
  final bool readOnly;

  @override
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  late bool _isObscured;

  @override
  void initState() {
    super.initState();
    _isObscured = widget.obscureText;
  }

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: widget.controller,
      keyboardType: widget.keyboardType,
      obscureText: _isObscured,
      maxLines: _isObscured ? 1 : widget.maxLines,
      maxLength: widget.maxLength,
      textInputAction: widget.textInputAction,
      readOnly: widget.readOnly,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        prefixIcon: widget.icon == null ? null : Icon(widget.icon),
        suffixIcon: widget.obscureText
            ? IconButton(
                icon: Icon(
                  _isObscured ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                ),
                onPressed: () {
                  setState(() {
                    _isObscured = !_isObscured;
                  });
                },
              )
            : null,
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  const AppTheme._();

  static const primary = Color(0xFF0F8B7B);
  static const background = Color(0xFFF7F9FB);
  static const text = Color(0xFF102A43);
  static const mutedText = Color(0xFF62748A);
  static const border = Color(0xFFE5EDF3);

  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: primary,
      primary: primary,
      surface: background,
      onSurface: text,
      surfaceContainerHighest: const Color(0xFFF0F4F8),
    );

    final baseTextTheme = GoogleFonts.outfitTextTheme();

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: background,
      textTheme: baseTextTheme.copyWith(
        displayLarge: baseTextTheme.displayLarge?.copyWith(color: text, fontWeight: FontWeight.w800, letterSpacing: -1.5),
        displayMedium: baseTextTheme.displayMedium?.copyWith(color: text, fontWeight: FontWeight.w800, letterSpacing: -1.0),
        displaySmall: baseTextTheme.displaySmall?.copyWith(color: text, fontWeight: FontWeight.w800, letterSpacing: -0.5),
        headlineLarge: baseTextTheme.headlineLarge?.copyWith(color: text, fontWeight: FontWeight.w700, letterSpacing: -0.5),
        headlineMedium: baseTextTheme.headlineMedium?.copyWith(color: text, fontWeight: FontWeight.w700),
        headlineSmall: baseTextTheme.headlineSmall?.copyWith(color: text, fontWeight: FontWeight.w700),
        titleLarge: baseTextTheme.titleLarge?.copyWith(color: text, fontWeight: FontWeight.w600),
        titleMedium: baseTextTheme.titleMedium?.copyWith(color: text, fontWeight: FontWeight.w600),
        titleSmall: baseTextTheme.titleSmall?.copyWith(color: text, fontWeight: FontWeight.w600),
        bodyLarge: baseTextTheme.bodyLarge?.copyWith(color: text),
        bodyMedium: baseTextTheme.bodyMedium?.copyWith(color: text),
        bodySmall: baseTextTheme.bodySmall?.copyWith(color: mutedText),
        labelLarge: baseTextTheme.labelLarge?.copyWith(color: primary, fontWeight: FontWeight.w600),
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 2,
        shadowColor: Colors.black.withValues(alpha: 0.05),
        backgroundColor: Colors.white,
        foregroundColor: text,
        centerTitle: true,
        iconTheme: const IconThemeData(color: text, size: 24),
        titleTextStyle: GoogleFonts.outfit(
          color: text,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.3,
        ),
      ),
      cardTheme: CardTheme(
        color: Colors.white,
        elevation: 8,
        shadowColor: Colors.black.withValues(alpha: 0.06),
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: border, width: 0.5),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF0F4F8),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 18,
        ),
        hintStyle: const TextStyle(color: mutedText, fontWeight: FontWeight.w400),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: primary, width: 2.0),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Colors.redAccent, width: 1.5),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: Colors.redAccent, width: 2.0),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 4,
          shadowColor: primary.withValues(alpha: 0.3),
          minimumSize: const Size.fromHeight(56),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, letterSpacing: 0.2),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: text,
          minimumSize: const Size.fromHeight(56),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          side: const BorderSide(color: border, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, letterSpacing: 0.2),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primary,
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: primary,
        unselectedItemColor: mutedText.withValues(alpha: 0.6),
        type: BottomNavigationBarType.fixed,
        elevation: 32,
        selectedLabelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, height: 1.5),
        unselectedLabelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500, height: 1.5),
        showUnselectedLabels: true,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: text,
        contentTextStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 8,
      ),
      dividerTheme: const DividerThemeData(
        color: border,
        space: 1,
        thickness: 1,
      ),
    );
  }
}

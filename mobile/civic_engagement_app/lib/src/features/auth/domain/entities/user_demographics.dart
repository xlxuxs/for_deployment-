import 'package:equatable/equatable.dart';

/// User demographic information required for registration
class UserDemographics extends Equatable {
  const UserDemographics({
    required this.ageRange,
    required this.gender,
    required this.occupation,
    required this.education,
  });

  final String ageRange;
  final String gender;
  final String occupation;
  final String education;

  @override
  List<Object?> get props => [ageRange, gender, occupation, education];
}

/// Age range options
class AgeRange {
  static const String range18_24 = '18-24';
  static const String range25_34 = '25-34';
  static const String range35_44 = '35-44';
  static const String range45_54 = '45-54';
  static const String range55Plus = '55+';

  static const List<String> all = [
    range18_24,
    range25_34,
    range35_44,
    range45_54,
    range55Plus,
  ];

  static String getLabel(String value) {
    return switch (value) {
      range18_24 => '18-24 years',
      range25_34 => '25-34 years',
      range35_44 => '35-44 years',
      range45_54 => '45-54 years',
      range55Plus => '55+ years',
      _ => value,
    };
  }
}

/// Gender options
class Gender {
  static const String male = 'male';
  static const String female = 'female';
  static const String nonBinary = 'non-binary';
  static const String preferNotToSay = 'prefer-not-to-say';

  static const List<String> all = [
    male,
    female,
    nonBinary,
    preferNotToSay,
  ];

  static String getLabel(String value) {
    return switch (value) {
      male => 'Male',
      female => 'Female',
      nonBinary => 'Non-binary',
      preferNotToSay => 'Prefer not to say',
      _ => value,
    };
  }
}

/// Occupation options
class Occupation {
  static const String student = 'student';
  static const String farmer = 'farmer';
  static const String merchant = 'merchant';
  static const String governmentEmployee = 'government-employee';
  static const String privateSector = 'private-sector';
  static const String unemployed = 'unemployed';
  static const String other = 'other';

  static const List<String> all = [
    student,
    farmer,
    merchant,
    governmentEmployee,
    privateSector,
    unemployed,
    other,
  ];

  static String getLabel(String value) {
    return switch (value) {
      student => 'Student',
      farmer => 'Farmer',
      merchant => 'Merchant',
      governmentEmployee => 'Government Employee',
      privateSector => 'Private Sector',
      unemployed => 'Unemployed',
      other => 'Other',
      _ => value,
    };
  }
}

/// Education level options
class Education {
  static const String noFormal = 'no-formal';
  static const String primary = 'primary';
  static const String secondary = 'secondary';
  static const String diploma = 'diploma';
  static const String bachelors = 'bachelors';
  static const String postgraduate = 'postgraduate';

  static const List<String> all = [
    noFormal,
    primary,
    secondary,
    diploma,
    bachelors,
    postgraduate,
  ];

  static String getLabel(String value) {
    return switch (value) {
      noFormal => 'No Formal Education',
      primary => 'Primary School',
      secondary => 'Secondary School',
      diploma => 'Diploma',
      bachelors => 'Bachelor\'s Degree',
      postgraduate => 'Postgraduate Degree',
      _ => value,
    };
  }
}

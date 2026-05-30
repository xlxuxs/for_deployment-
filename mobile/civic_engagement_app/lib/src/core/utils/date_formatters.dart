class DateFormatters {
  const DateFormatters._();

  static String short(DateTime? value) {
    if (value == null) return 'Not set';
    final local = value.toLocal();
    return '${_two(local.day)} ${_month(local.month)} ${local.year}';
  }

  static String compact(DateTime? value) {
    if (value == null) return 'Not set';
    final local = value.toLocal();
    return '${_two(local.day)}/${_two(local.month)}/${local.year}';
  }

  static String _two(int value) => value.toString().padLeft(2, '0');

  static String _month(int month) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[month - 1];
  }
}

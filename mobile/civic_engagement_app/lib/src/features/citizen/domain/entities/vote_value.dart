/// Helper class to format vote values based on poll type
class VoteValueFormatter {
  /// Format a vote value for display
  static String format(dynamic value, String pollType) {
    if (value == null) return 'N/A';

    switch (pollType) {
      case 'binary':
        return value.toString().toUpperCase(); // YES or NO
      case 'rating':
      case 'likert':
        return '$value / 5';
      case 'approval':
        return _formatApproval(value.toString());
      case 'multipleChoice':
        if (value is List) {
          return value.join(', ');
        }
        return value.toString();
      case 'rankedChoice':
        if (value is List) {
          return value.asMap().entries.map((e) => '${e.key + 1}. ${e.value}').join(', ');
        }
        return value.toString();
      default:
        return value.toString();
    }
  }

  static String _formatApproval(String value) {
    switch (value.toLowerCase()) {
      case 'approve':
        return 'Approve';
      case 'reject':
        return 'Reject';
      case 'abstain':
        return 'Abstain';
      default:
        return value;
    }
  }

  /// Validate vote value for a given poll type
  static bool isValid(dynamic value, String pollType, {int? maxSelections, int? maxRank}) {
    if (value == null) return false;

    switch (pollType) {
      case 'binary':
        return value is String && (value.toLowerCase() == 'yes' || value.toLowerCase() == 'no');
      case 'rating':
      case 'likert':
        return value is int && value >= 1 && value <= 5;
      case 'approval':
        if (value is! String) return false;
        final lower = value.toLowerCase();
        return lower == 'approve' || lower == 'reject' || lower == 'abstain';
      case 'multipleChoice':
        if (value is! List) return false;
        if (maxSelections != null && value.length > maxSelections) return false;
        return value.isNotEmpty;
      case 'rankedChoice':
        if (value is! List) return false;
        if (maxRank != null && value.length > maxRank) return false;
        return value.isNotEmpty;
      default:
        return false;
    }
  }
}

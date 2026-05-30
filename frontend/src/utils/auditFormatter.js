export const formatAuditDetails = (event) => {
  const { action, details } = event;
  if (!details) return null;

  switch (action) {
    case "CLONE_POLICY":
      return `Cloned from policy ${details.originalPolicyCode} to ${details.newPolicyCode}`;
    case "PUBLISH_POLICY":
      return `Status changed from ${details.fromStatus} to ${details.toStatus}`;
    case "UNPUBLISH_POLICY":
      return "Status changed from published to draft";
    case "UPDATE_POLICY":
      return formatUpdatePolicy(details);
    case "ARCHIVE_POLICY":
      return "Policy archived";
    case "RESTORE_POLICY":
      return "Policy restored from archive";
    case "DELETE_POLICY":
      return "Policy deleted";
    case "CREATE_POLICY":
      return "Policy created";
    case "PAUSE_POLICY":
      return "Policy paused";
    case "RESUME_POLICY":
      return "Policy resumed";
    case "CLOSE_POLICY":
      return "Policy closed";
    case "EXTEND_POLICY":
      return `End date extended to ${details.newEndDate}`;
    default:
      return JSON.stringify(details, null, 2);
  }
};

// Helper to format UPDATE_POLICY changes in a human‑friendly way
function formatUpdatePolicy(details) {
  const changes = details.changes;
  if (!changes || Object.keys(changes).length === 0)
    return "Policy updated (no changes recorded)";
  const fieldNames = Object.keys(changes).join(", ");
  return `Changed fields: ${fieldNames}`;
}

// Helper to format ISO date strings to YYYY-MM-DD
function formatDate(isoString) {
  if (!isoString) return "unknown";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toISOString().slice(0, 10);
}

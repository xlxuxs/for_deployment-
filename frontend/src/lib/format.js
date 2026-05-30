export function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function toIsoFromDateInput(value, endOfDay = false) {
  if (!value) return "";
  const suffix = endOfDay ? "T23:59:59.000Z" : "T00:00:00.000Z";
  return `${value}${suffix}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en").format(Number(value || 0));
}

export function formatRating(value) {
  const number = Number(value || 0);
  return number.toFixed(2);
}

export function getErrorMessage(error, fallback = "Something went wrong") {
  return error?.message || fallback;
}
export function daysRemaining(futureDate) {
  if (!futureDate) return 0;
  const expiry = new Date(futureDate);
  const now = new Date();
  const diffTime = expiry - now;
  if (diffTime <= 0) return 0;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

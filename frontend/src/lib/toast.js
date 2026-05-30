let _showFn = null;

export function registerShowToast(fn) {
  _showFn = fn;
}

export function showToast(type, message, opts = {}) {
  if (!_showFn) return;
  _showFn({
    id: Date.now() + Math.random().toString(36).slice(2, 8),
    type: type || "info",
    message: String(message || ""),
    duration: opts.duration || 5000,
  });
}

export default showToast;

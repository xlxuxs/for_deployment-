import { useI18n } from "../i18n/I18nProvider";

function getInitialUiTheme() {
  if (typeof window === "undefined") return "light";

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;

  return (
    document.documentElement.dataset.uiTheme ||
    window.localStorage.getItem("civic_dashboard_theme") ||
    window.localStorage.getItem("civic_ui_theme") ||
    (prefersDark ? "dark" : "light") ||
    "light"
  );
}

export function LoadingState({ label = "Loading", fullScreen = false }) {
  const { t } = useI18n();
  const isDark = getInitialUiTheme() === "dark";

  return (
    <div
      className={[
        fullScreen ? "grid min-h-screen place-items-center" : "grid min-h-48 place-items-center",
        isDark ? "bg-slate-950" : "bg-slate-50",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold shadow-sm",
          isDark
            ? "border border-slate-700 bg-slate-900 text-slate-200"
            : "border border-slate-200 bg-white text-slate-600",
        ].join(" ")}
      >
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
        {t(label)}
      </div>
    </div>
  );
}

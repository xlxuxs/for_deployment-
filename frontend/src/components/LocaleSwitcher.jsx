import { Languages } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

export function LocaleSwitcher({ className = "", compact = false }) {
  const { locale, locales, setLocale, t } = useI18n();

  return (
    <label className={`inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ${className}`}>
      <Languages className="h-4 w-4 text-teal-700" />
      {!compact ? <span className="hidden sm:inline">{t("Language")}</span> : null}
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value)}
        aria-label={t("Language")}
        className="bg-transparent text-sm font-semibold text-slate-700 outline-none"
      >
        {locales.map((item) => (
          <option key={item.code} value={item.code}>
            {item.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

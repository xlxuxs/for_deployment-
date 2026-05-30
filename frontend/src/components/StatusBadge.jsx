import { useI18n } from "../i18n/I18nProvider";

const STATUS_CLASSES = {
  draft: "bg-slate-100 text-slate-700",
  published: "bg-sky-100 text-sky-700",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-800",
  closed: "bg-rose-100 text-rose-700",
};

export function StatusBadge({ status }) {
  const { t } = useI18n();

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold capitalize",
        STATUS_CLASSES[status] || "bg-slate-100 text-slate-700",
      ].join(" ")}
    >
      {t(status || "unknown")}
    </span>
  );
}

import { useI18n } from "../i18n/I18nProvider";

export function MetricCard({ label, value, helper, icon: Icon }) {
  const { t } = useI18n();

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{typeof label === "string" ? t(label) : label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
        </div>
        {Icon ? (
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-50 text-teal-700">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      {helper ? <p className="mt-3 text-sm text-slate-500">{typeof helper === "string" ? t(helper) : helper}</p> : null}
    </article>
  );
}

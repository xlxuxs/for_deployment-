import { useI18n } from "../i18n/I18nProvider";

export function PageHeader({ title, description, actions }) {
  const { t } = useI18n();

  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{typeof title === "string" ? t(title) : title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{typeof description === "string" ? t(description) : description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

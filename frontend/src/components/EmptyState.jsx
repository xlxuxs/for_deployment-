import { isValidElement } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nProvider";

export function EmptyState({ title, description, action }) {
  const { t } = useI18n();
  const actionNode = isValidElement(action)
    ? action
    : action?.label && action?.to
      ? (
        <Link
          to={action.to}
          className="inline-flex items-center rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800"
        >
          {t(action.label)}
        </Link>
        )
      : null;

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <h3 className="text-lg font-bold text-slate-950">{typeof title === "string" ? t(title) : title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{typeof description === "string" ? t(description) : description}</p> : null}
      {actionNode ? <div className="mt-5">{actionNode}</div> : null}
    </div>
  );
}

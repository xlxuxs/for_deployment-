import { X } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";

export function Modal({ title, children, onClose }) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-lg font-bold text-slate-950">{typeof title === "string" ? t(title) : title}</h3>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            aria-label={t("Close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(90vh-4rem)] overflow-y-auto p-5">{children}</div>
      </section>
    </div>
  );
}

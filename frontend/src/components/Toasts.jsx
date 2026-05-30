import { useEffect, useState } from "react";
import { registerShowToast } from "../lib/toast";
import { useI18n } from "../i18n/I18nProvider";

function Toast({ t, onClose }) {
  const { t: translate } = useI18n();
  const bg = t.type === "error" ? "bg-rose-600" : "bg-emerald-600";
  return (
    <div className={`max-w-md w-full rounded-lg shadow-lg text-white p-4 ${bg} ring-1 ring-black/10`}> 
      <div className="text-base font-semibold leading-6">{translate(t.message)}</div>
    </div>
  );
}

export function ToastsProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    registerShowToast((t) => {
      setToasts((prev) => [...prev, t]);
      if (t.duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id));
        }, t.duration);
      }
    });
  }, []);

  return (
    <>
      {children}
      <div style={{ zIndex: 60 }} className="fixed top-20 right-4 flex flex-col gap-3">
        {toasts.map((t) => (
          <Toast key={t.id} t={t} />
        ))}
      </div>
    </>
  );
}

export default ToastsProvider;

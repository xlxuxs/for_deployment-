import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { useI18n } from "../i18n/I18nProvider";

export const PasswordField = React.forwardRef(function PasswordField(
  {
    label,
    error,
    helperText,
    disabled = false,
    inputClassName = "",
    wrapperClassName = "",
    ...inputProps
  },
  ref,
) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  const inputId = inputProps.id || generatedId;

  return (
    <label className={`block ${wrapperClassName}`} htmlFor={inputId}>
      <span className="text-sm font-semibold text-slate-700">{typeof label === "string" ? t(label) : label}</span>
      <div className="relative mt-1">
        <input
          ref={ref}
          id={inputId}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={`w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 ${inputClassName}`}
          {...inputProps}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          aria-label={visible ? t("Hide password") : t("Show password")}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {helperText ? <p className="mt-1 text-xs text-slate-500">{typeof helperText === "string" ? t(helperText) : helperText}</p> : null}
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-600">{typeof error === "string" ? t(error) : error}</span> : null}
    </label>
  );
});

import React, { useState } from "react";
import { translateText } from "../api/translation";

const LANG_OPTIONS = [
  { code: "en", label: "English" },
  { code: "am", label: "Amharic" },
  { code: "om", label: "Oromo" },
  { code: "ti", label: "Tigrinya" },
];

export default function LanguageSelector({ text, onTranslated }) {
  const [target, setTarget] = useState("en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTranslate = async () => {
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const result = await translateText({ text, targetLang: target });
      if (onTranslated) onTranslated(result, target);
    } catch (e) {
      setError(e.message || "Translation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none"
      >
        {LANG_OPTIONS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>

      <button
        onClick={handleTranslate}
        className="rounded bg-sky-600 px-3 py-1 text-sm font-bold text-white disabled:opacity-60"
        disabled={loading || !text}
      >
        {loading ? "Translating..." : "Translate"}
      </button>

      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}

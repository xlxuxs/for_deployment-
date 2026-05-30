import { X } from "lucide-react";
import { useState } from "react";

// Helper: normalize tag (capitalize each word, trim)
const normalizeTag = (tag) => {
  return tag
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

export function TagInput({ tags, onChange, placeholder, suggestions = [] }) {
  const [inputValue, setInputValue] = useState("");

  const addTag = (rawTag) => {
    const normalized = normalizeTag(rawTag);
    if (!normalized) return;
    if (!tags.includes(normalized)) {
      onChange([...tags, normalized]);
    }
    setInputValue("");
  };

  const removeTag = (tagToRemove) => {
    onChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && inputValue) {
      e.preventDefault();
      addTag(inputValue);
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => inputValue && addTag(inputValue)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
      />
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-800"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full p-0.5 hover:bg-teal-200"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => {
            const isAlreadyAdded = tags.includes(normalizeTag(suggestion));
            return (
              <button
                key={suggestion}
                type="button"
                onClick={() => !isAlreadyAdded && addTag(suggestion)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  isAlreadyAdded
                    ? "border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                disabled={isAlreadyAdded}
              >
                {suggestion}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

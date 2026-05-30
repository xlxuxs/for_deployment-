import { Plus, Trash2 } from "lucide-react";

export function PollOptionsEditor({ options, onChange, maxOptions = 10 }) {
  const addOption = () => {
    const newId = Date.now().toString();
    onChange([...options, { id: newId, text: "", shortCode: "" }]);
  };

  const updateOptionText = (index, text) => {
    const updated = [...options];
    updated[index].text = text;
    onChange(updated);
  };

  const removeOption = (index) => {
    const updated = options.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {options.map((opt, idx) => (
        <div
          key={opt.id || idx}
          className="flex items-center gap-2 rounded-lg border border-slate-200 p-3"
        >
          <div className="flex-1">
            <input
              type="text"
              value={opt.text}
              onChange={(e) => updateOptionText(idx, e.target.value)}
              placeholder={`Option ${idx + 1}`}
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal-600"
              required
            />
          </div>
          <button
            type="button"
            onClick={() => removeOption(idx)}
            className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {options.length < maxOptions && (
        <button
          type="button"
          onClick={addOption}
          className="inline-flex items-center gap-2 rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
        >
          <Plus className="h-4 w-4" />
          Add option
        </button>
      )}
      {options.length === maxOptions && (
        <p className="text-xs text-amber-600">
          Maximum {maxOptions} options reached.
        </p>
      )}
    </div>
  );
}

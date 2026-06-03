import React from "react";

export default function PollChoices({ policy }) {
  if (!policy) return null;

  const renderOptionTags = (options = []) => (
    <div className="mt-2 flex flex-wrap">
      {(options || []).map((opt, i) => (
        <span
          key={opt?.id || opt?.text || opt || i}
          className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 mr-2 mb-2"
        >
          {opt?.text || opt}
        </span>
      ))}
    </div>
  );

  if (policy.pollType === "binary") {
    return <div>{renderOptionTags(["Yes", "No"])}</div>;
  }

  if (policy.pollType === "rating") {
    return (
      <div>
        {renderOptionTags([1, 2, 3, 4, 5].map((n) => `${n} star${n > 1 ? "s" : ""}`))}
      </div>
    );
  }

  if (policy.pollType === "likert") {
    return (
      <div>
        {renderOptionTags((policy.likertLabels || []).map((label, index) => `${index + 1}. ${label}`))}
      </div>
    );
  }

  if (policy.pollType === "multipleChoice") {
    const options = (policy.pollOptions || []).map((option) => option.text);
    return (
      <div>
        {renderOptionTags(options)}
        {policy.maxSelections > 1 && (
          <div className="mt-1 text-xs text-slate-500">Select up to {policy.maxSelections}.</div>
        )}
      </div>
    );
  }

  if (policy.pollType === "approval") {
    return <div>{renderOptionTags((policy.pollOptions || []).map((o) => o.text))}</div>;
  }

  if (policy.pollType === "rankedChoice") {
    const options = (policy.pollOptions || []).map((option) => option.text);
    return (
      <div>
        {renderOptionTags(options)}
        {policy.rankedChoiceMaxRank && (
          <div className="mt-1 text-xs text-slate-500">Rank up to {policy.rankedChoiceMaxRank}.</div>
        )}
      </div>
    );
  }

  return <div className="text-sm text-slate-500">No choices configured</div>;
}

import { useEffect, useRef } from "react";

export function OtpInput({ value = "", onChange, length = 6, disabled = false }) {
  const inputRefs = useRef([]);

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index, val) => {
    // Only allow digits
    if (!/^\d*$/.test(val)) return;

    // Create new value with the changed digit
    const digits = value.split("");
    digits[index] = val.slice(-1); // Take only last char (in case of paste)
    const newValue = digits.slice(0, length).join("");

    onChange(newValue);

    // Auto-advance to next field
    if (val && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (!value[index] && index > 0) {
        // Focus previous if current is empty
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text");
    const digits = paste.replace(/\D/g, "").slice(0, length);
    onChange(digits);

    // Focus last field after paste
    setTimeout(() => {
      const nextIndex = Math.min(digits.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
    }, 0);
  };

  return (
    <div className="flex gap-2">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength="1"
          value={value[index] || ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          className="h-12 w-12 flex-1 rounded-lg border border-slate-300 text-center text-lg font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400"
        />
      ))}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { showToast } from "../lib/toast";

export function ErrorAlert({ message }) {
  const lastShownMessageRef = useRef("");

  useEffect(() => {
    if (!message) {
      lastShownMessageRef.current = "";
      return;
    }

    if (lastShownMessageRef.current === message) {
      return;
    }

    lastShownMessageRef.current = message;
    try {
      showToast("error", message);
    } catch {
      // Ignore toast failures.
    }
  }, [message]);

  if (!message) return null;
  return null;
}

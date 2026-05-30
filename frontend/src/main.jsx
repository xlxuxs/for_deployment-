import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";
import { I18nProvider } from "./i18n/I18nProvider.jsx";
import "./index.css";

// Load reCAPTCHA v3 script when a site key is provided at build time
// Do NOT load on localhost to avoid Google showing "Localhost is not in the list..."
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
try {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (RECAPTCHA_SITE_KEY && !isLocalhost) {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    s.async = true;
    document.head.appendChild(s);
  }
} catch (e) {
  // ignore errors while trying to detect hostname
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

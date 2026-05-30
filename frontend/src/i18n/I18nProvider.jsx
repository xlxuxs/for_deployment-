import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LOCALE, I18N_STORAGE_KEY, LOCALES, TRANSLATIONS } from "./translations";

const I18nContext = createContext(null);
const originalTextMap = new WeakMap();
const REVERSE_TRANSLATIONS = buildReverseTranslations();

function getInitialLocale() {
  if (typeof window === "undefined") return DEFAULT_LOCALE;

  try {
    const stored = window.localStorage.getItem(I18N_STORAGE_KEY);
    if (LOCALES.some((locale) => locale.code === stored)) {
      return stored;
    }
  } catch {
    // Ignore storage failures.
  }

  return DEFAULT_LOCALE;
}

function normalizeMessage(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildReverseTranslations() {
  const reverse = new Map();

  Object.entries(TRANSLATIONS).forEach(([english, localizedValues]) => {
    reverse.set(normalizeMessage(english), english);
    Object.values(localizedValues || {}).forEach((localized) => {
      reverse.set(normalizeMessage(localized), english);
    });
  });

  return reverse;
}

function translateMessage(message, locale, params) {
  const source = String(message ?? "");
  if (!source) {
    return interpolate(source, params);
  }

  const normalized = normalizeMessage(source);
  const canonical = REVERSE_TRANSLATIONS.get(normalized) || normalized;
  const entry = TRANSLATIONS[canonical];

  if (locale === DEFAULT_LOCALE) {
    return interpolate(canonical || source, params);
  }

  const translated = entry?.[locale] || source;
  return interpolate(translated, params);
}

function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}

function shouldSkipNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (parent.closest("[data-i18n-skip='true']")) return true;
  return ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName);
}

function translateDomTree(root, locale) {
  if (!root || typeof window === "undefined") return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (shouldSkipNode(node)) return NodeFilter.FILTER_REJECT;
      return normalizeMessage(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let currentNode = walker.nextNode();
  while (currentNode) {
    const original = originalTextMap.get(currentNode) ?? currentNode.nodeValue;
    if (!originalTextMap.has(currentNode)) {
      originalTextMap.set(currentNode, original);
    }
    const translated = translateMessage(original, locale);
    if (currentNode.nodeValue !== translated) {
      currentNode.nodeValue = translated;
    }
    currentNode = walker.nextNode();
  }

  const attributeSelectors = [
    ["input[placeholder], textarea[placeholder]", "placeholder"],
    ["[title]", "title"],
    ["[aria-label]", "aria-label"],
  ];

  attributeSelectors.forEach(([selector, attribute]) => {
    root.querySelectorAll(selector).forEach((element) => {
      const storeKey = `i18nOriginal${attribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}`;
      const currentValue = element.getAttribute(attribute);
      const original = element.dataset[storeKey] || currentValue;
      if (!original) return;
      element.dataset[storeKey] = original;
      const translated = translateMessage(original, locale);
      if (currentValue !== translated) {
        element.setAttribute(attribute, translated);
      }
    });
  });
}

export function I18nProvider({ children }) {
  const [locale, setLocale] = useState(getInitialLocale);
  const observerRef = useRef(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(I18N_STORAGE_KEY, locale);
    } catch {
      // Ignore storage failures.
    }

    document.documentElement.lang = LOCALES.find((item) => item.code === locale)?.htmlLang || locale;
  }, [locale]);

  useEffect(() => {
    const root = document.body;
    if (!root) return undefined;

    translateDomTree(root, locale);

    observerRef.current?.disconnect();
    const observer = new MutationObserver(() => {
      translateDomTree(root, locale);
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });
    observerRef.current = observer;

    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      locales: LOCALES,
      t: (message, params) => translateMessage(message, locale, params),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

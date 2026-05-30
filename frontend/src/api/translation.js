import { apiClient } from "./client";

/**
 * Translate text via backend.
 * - `text` (string) required
 * - `targetLang` (string) optional, defaults to "en"
 * - `sourceLang` optional (backend will auto-detect if omitted)
 */
export async function translateText({ text, targetLang = "en", sourceLang = null }) {
  const body = { text, targetLang };
  if (sourceLang) body.sourceLang = sourceLang;
  const resp = await apiClient.post("/translate", body);
  return resp.translatedText || resp;
}

export default translateText;

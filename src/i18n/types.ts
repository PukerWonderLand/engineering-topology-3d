export type Locale = "zh-CN" | "en-US";

export const DEFAULT_LOCALE: Locale = "zh-CN";
export const LOCALE_STORAGE_KEY = "t113-xvc-locale";

export function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en-US";
}

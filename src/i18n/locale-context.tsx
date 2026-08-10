"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { enUS } from "./en-US";
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY, type Locale } from "./types";

let activeLocale: Locale = DEFAULT_LOCALE;
const proxyCache = new WeakMap<object, object>();
const reverseEnglish = new Map(Object.entries(enUS).map(([zh, en]) => [en.toLowerCase(), zh]));
const pageTitle = "T113 ARM-XVC 远程 FPGA 调试架构";
const pageDescription = "交互式 3D 展示 x86 FPGA 工具设备、可信局域网、T113 ARMv7 XVC 网关、USB 扩展坞、JTAG 下载器、KU15P 与 690T 的物理链路和证据边界。";

export function setActiveLocale(locale: Locale) {
  activeLocale = locale;
}

export function translateText(text: string, locale: Locale = activeLocale): string {
  return locale === "en-US" ? enUS[text] ?? text : text;
}

export function translationVariants(text: string): string[] {
  const english = enUS[text];
  if (english) return [text, english];
  const chinese = reverseEnglish.get(text.toLowerCase());
  return chinese ? [chinese, text] : [text];
}

/**
 * Keeps stable IDs and object identity while translating display strings on read.
 * The locale state still drives React re-renders; the proxy only avoids cloning the
 * topology graph and accidentally changing node/edge relationships.
 */
export function localizedProxy<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  const cached = proxyCache.get(value as object);
  if (cached) return cached as T;

  const proxy = new Proxy(value as object, {
    get(target, property, receiver) {
      const result = Reflect.get(target, property, receiver);
      if (typeof result === "string") return translateText(result);
      if (result !== null && typeof result === "object") return localizedProxy(result);
      return result;
    },
  });
  proxyCache.set(value as object, proxy);
  return proxy as T;
}

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  tr: (text: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  const applyLocale = useCallback((nextLocale: Locale, persist: boolean) => {
    setActiveLocale(nextLocale);
    setLocaleState(nextLocale);
    if (persist) window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) applyLocale(stored, false);
  }, [applyLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
    document.title = translateText(pageTitle, locale);
    document.querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", translateText(pageDescription, locale));

    // Re-measure camera-facing cards after English/Chinese text changes.
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => applyLocale(nextLocale, true), [applyLocale]);
  const tr = useCallback((text: string) => translateText(text, locale), [locale]);
  const contextValue = useMemo(() => ({ locale, setLocale, tr }), [locale, setLocale, tr]);

  return <LocaleContext.Provider value={contextValue}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

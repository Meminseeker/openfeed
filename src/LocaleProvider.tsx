import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  defaultLocale,
  initialLocale,
  localeNames,
  locales,
  localeStorageKey,
  translator,
  type Locale,
  type Translate,
} from "./i18n";

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}
const I18nContext = createContext<I18nValue>({
  locale: defaultLocale,
  setLocale: () => {},
  t: translator(defaultLocale),
});

function storedLocale() {
  try {
    return localStorage.getItem(localeStorageKey);
  } catch {
    return null;
  }
}

// The language is a per-browser preference, so it also applies on the
// login page before any account is known.
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    initialLocale(storedLocale(), navigator.languages ?? [navigator.language]),
  );
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: translator(locale),
      setLocale: (next) => {
        setLocaleState(next);
        try {
          localStorage.setItem(localeStorageKey, next);
        } catch {}
      },
    }),
    [locale],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = value.t("app.title");
  }, [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

export function LanguageSelect({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={`language-select ${className ?? ""}`}>
      <span>{t("language.label")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

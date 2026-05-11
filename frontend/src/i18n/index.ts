import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en';
import de from './locales/de';

export type SupportedLocale = 'en' | 'de';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'de'];

function detectBrowserLocale(): SupportedLocale {
  const lang = navigator.language.split('-')[0].toLowerCase();
  return (SUPPORTED_LOCALES as string[]).includes(lang) ? (lang as SupportedLocale) : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
  },
  lng: detectBrowserLocale(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;

/** Change language and persist to localStorage */
export function setLocale(locale: SupportedLocale) {
  i18n.changeLanguage(locale);
  localStorage.setItem('fittrack-locale', locale);
}

/** Read persisted locale on startup (call before rendering) */
export function loadPersistedLocale() {
  const saved = localStorage.getItem('fittrack-locale') as SupportedLocale | null;
  if (saved && SUPPORTED_LOCALES.includes(saved)) {
    i18n.changeLanguage(saved);
  }
}

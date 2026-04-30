/**
 * Ambient module shims — kept minimal. These act as a fallback when a
 * dependency's published types aren't yet resolved (e.g. mid-install). When
 * `npm install` finishes on the developer's machine, the package's real
 * types take precedence over these declarations.
 */

declare module '@react-native-async-storage/async-storage' {
  interface AsyncStorageStatic {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    multiGet(keys: string[]): Promise<[string, string | null][]>;
    multiSet(pairs: [string, string][]): Promise<void>;
    multiRemove(keys: string[]): Promise<void>;
    getAllKeys(): Promise<string[]>;
  }
  const AsyncStorage: AsyncStorageStatic;
  export default AsyncStorage;
}

declare module 'intl-pluralrules';

declare module 'expo-localization' {
  export interface Locale {
    languageCode: string | null;
    languageTag: string | null;
    regionCode: string | null;
    textDirection: 'ltr' | 'rtl' | null;
  }
  export function getLocales(): Locale[];
  export const locale: string;
}

declare module 'expo-updates' {
  export function reloadAsync(): Promise<void>;
}

declare module 'i18next' {
  export interface I18n {
    isInitialized: boolean;
    language: string;
    use(plugin: unknown): I18n;
    init(opts: Record<string, unknown>): Promise<unknown>;
    changeLanguage(lng: string): Promise<unknown>;
    t(key: string, opts?: Record<string, unknown>): string;
  }
  const instance: I18n;
  export default instance;
}

declare module 'react-i18next' {
  export interface UseTranslationResponse {
    t: (key: string, opts?: Record<string, unknown>) => string;
    i18n: { language: string; changeLanguage: (lng: string) => Promise<unknown> };
  }
  export function useTranslation(ns?: string | string[]): UseTranslationResponse;
  export const initReactI18next: unknown;
}

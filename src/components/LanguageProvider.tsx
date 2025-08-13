'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type Locale = 'vi' | 'en';

type LanguageContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('vi');
  const value = useMemo(
    () => ({
      locale,
      setLocale,
      toggle: () => setLocale((prev) => (prev === 'vi' ? 'en' : 'vi')),
    }),
    [locale]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
} 
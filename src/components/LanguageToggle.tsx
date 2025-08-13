'use client';

import { useLanguage } from './LanguageProvider';

export default function LanguageToggle() {
  const { locale, toggle } = useLanguage();
  return (
    <button onClick={toggle} className="border px-3 py-1 rounded">
      {locale === 'vi' ? 'Tiếng Việt' : 'English'}
    </button>
  );
} 
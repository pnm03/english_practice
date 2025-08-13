'use client';

// If @types/react-google-recaptcha is not available, this suppresses TS error for module typing.
// Alternatively, install: npm i -D @types/react-google-recaptcha
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - types may be missing in some environments
import ReCAPTCHA from 'react-google-recaptcha';

export default function ReCaptcha({ onVerify }: { onVerify: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey) {
    return (
      <div className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded p-2">
        Thiếu cấu hình reCAPTCHA. Thêm NEXT_PUBLIC_RECAPTCHA_SITE_KEY vào .env.local để bật xác thực.
      </div>
    );
  }
  return <ReCAPTCHA sitekey={siteKey} onChange={(token: string | null) => onVerify(token)} />;
} 
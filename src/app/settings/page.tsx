import Link from 'next/link';

export default function SettingsIndex() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Cài đặt</h1>
      <ul className="list-disc ml-6 text-sm">
        <li><Link className="underline" href="/settings/profile">Thông tin cá nhân</Link></li>
        <li><Link className="underline" href="/settings/preferences">Cài đặt ứng dụng</Link></li>
      </ul>
    </div>
  );
} 
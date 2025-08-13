'use client';

import { getBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';

export default function ProfileForm({ initialEmail, initialName, initialAvatar }: { initialEmail: string; initialName: string; initialAvatar: string; }) {
  const supabase = getBrowserSupabaseClient();
  const { showToast } = useToast();
  const [fullName, setFullName] = useState(initialName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const uploadAvatar = async (file: File) => {
    const fileName = `${crypto.randomUUID()}.${file.name.split('.').pop()}`;
    const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: false, cacheControl: '3600' });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ data: { full_name: fullName, avatar_url: avatarUrl } });
      if (error) throw error;
      setMessage('Đã lưu hồ sơ.');
      showToast('Đã lưu thông tin cá nhân', { type: 'success' });
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setMessage('Đổi mật khẩu thành công.');
      showToast('Đổi mật khẩu thành công', { type: 'success' });
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={saveProfile} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input disabled value={initialEmail} className="w-full rounded-md border px-3 py-2 bg-neutral-50 dark:bg-neutral-900" />
        </div>
        <div>
          <label className="block text-sm font-medium">Họ và tên</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-md border px-3 py-2 bg-transparent" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Ảnh đại diện</label>
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="avatar" className="h-16 w-16 rounded-full object-cover" />
          )}
          <input type="file" accept="image/*" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              setLoading(true);
              const url = await uploadAvatar(file);
              setAvatarUrl(url);
            } catch (err: unknown) {
              setMessage(err instanceof Error ? err.message : 'Tải ảnh thất bại.');
            } finally {
              setLoading(false);
            }
          }} />
        </div>
        <button type="submit" disabled={loading} className="rounded-md bg-black text-white dark:bg-white dark:text-black px-4 py-2 text-sm">Lưu hồ sơ</button>
      </form>

      <form onSubmit={changePassword} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Mật khẩu mới</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border px-3 py-2 bg-transparent" />
        </div>
        <button type="submit" disabled={loading || !password} className="rounded-md border px-4 py-2 text-sm">Đổi mật khẩu</button>
      </form>

      {message && <p className="text-sm text-neutral-600 dark:text-neutral-300">{message}</p>}
    </div>
  );
} 
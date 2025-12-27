import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Lock, Info, Shield, Volume2, Play, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import {
  SoundTheme,
  soundThemes,
  getSoundTheme,
  setSoundTheme,
  getSoundVolume,
  setSoundVolume,
  previewThemeSound,
} from '../utils/sounds';
import clsx from 'clsx';

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Kierownik',
  WAREHOUSE: 'Magazynier',
};

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Sound settings
  const [selectedTheme, setSelectedTheme] = useState<SoundTheme>(getSoundTheme());
  const [volume, setVolume] = useState(getSoundVolume());

  const handleThemeChange = (theme: SoundTheme) => {
    setSelectedTheme(theme);
    setSoundTheme(theme);
    // Play preview of success sound
    setTimeout(() => previewThemeSound(theme, 'success'), 100);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setSoundVolume(newVolume);
  };

  const playPreview = (type: 'success' | 'error' | 'warning' | 'location') => {
    previewThemeSound(selectedTheme, type);
  };

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await api.post('/auth/change-password', data);
      return response.data;
    },
    onSuccess: () => {
      setShowPasswordForm(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Hasło zostało zmienione');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd zmiany hasła');
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      toast.error('Wypełnij wymagane pola');
      return;
    }
    if (passwordData.newPassword.length < 8) {
      toast.error('Nowe hasło musi mieć minimum 8 znaków');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Hasła nie są identyczne');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  return (
    <Layout title="Ustawienia">
      <div className="space-y-4">
        {/* Profile */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary-500/20">
              <User className="w-5 h-5 text-primary-400" />
            </div>
            <h2 className="font-medium text-white">Profil użytkownika</h2>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-slate-400">Imię i nazwisko</span>
              <span className="text-white font-medium">{user?.name}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-slate-400">Login</span>
              <span className="text-white font-mono">{user?.username}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-400">Rola</span>
              <span className="px-2 py-1 rounded-lg bg-primary-500/20 text-primary-400 text-sm font-medium">
                {roleLabels[user?.role || ''] || user?.role}
              </span>
            </div>
          </div>
        </div>

        {/* Password */}
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/20">
                <Lock className="w-5 h-5 text-yellow-400" />
              </div>
              <h2 className="font-medium text-white">Bezpieczeństwo</h2>
            </div>
            {!showPasswordForm && (
              <Button size="sm" variant="ghost" onClick={() => setShowPasswordForm(true)}>
                Zmień hasło
              </Button>
            )}
          </div>

          {showPasswordForm ? (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <Input
                type="password"
                label="Obecne hasło"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              />
              <Input
                type="password"
                label="Nowe hasło"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              />
              <Input
                type="password"
                label="Potwierdź nowe hasło"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1"
                >
                  Anuluj
                </Button>
                <Button type="submit" loading={changePasswordMutation.isPending} className="flex-1">
                  Zapisz
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-slate-400 text-sm">
              Zalecamy regularną zmianę hasła w celu ochrony konta.
            </p>
          )}
        </div>

        {/* Sound Settings */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Volume2 className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="font-medium text-white">Dźwięki skanera</h2>
          </div>

          {/* Theme selection */}
          <div className="space-y-3 mb-4">
            <label className="text-sm text-slate-400">Motyw dźwiękowy</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(soundThemes) as SoundTheme[]).map((theme) => (
                <button
                  key={theme}
                  onClick={() => handleThemeChange(theme)}
                  className={clsx(
                    'p-3 rounded-xl text-left transition-all',
                    selectedTheme === theme
                      ? 'bg-purple-500/20 ring-2 ring-purple-500/50'
                      : 'bg-white/5 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-white text-sm">
                      {soundThemes[theme].name}
                    </span>
                    {selectedTheme === theme && (
                      <Check className="w-4 h-4 text-purple-400" />
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {soundThemes[theme].description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Volume slider */}
          <div className="mb-4">
            <label className="text-sm text-slate-400 mb-2 block">
              Głośność: {Math.round(volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:bg-purple-500
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:bg-purple-500
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:cursor-pointer
                [&::-moz-range-thumb]:border-0"
            />
          </div>

          {/* Preview buttons */}
          <div>
            <label className="text-sm text-slate-400 mb-2 block">Podgląd dźwięków</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => playPreview('success')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm hover:bg-green-500/30 transition-colors"
              >
                <Play className="w-3 h-3" />
                Sukces
              </button>
              <button
                onClick={() => playPreview('error')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30 transition-colors"
              >
                <Play className="w-3 h-3" />
                Błąd
              </button>
              <button
                onClick={() => playPreview('warning')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-sm hover:bg-yellow-500/30 transition-colors"
              >
                <Play className="w-3 h-3" />
                Ostrzeżenie
              </button>
              <button
                onClick={() => playPreview('location')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm hover:bg-blue-500/30 transition-colors"
              >
                <Play className="w-3 h-3" />
                Lokalizacja
              </button>
            </div>
          </div>
        </div>

        {/* Permissions */}
        {user?.permissions && user.permissions.length > 0 && (
          <div className="glass-card p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <h2 className="font-medium text-white">Uprawnienia</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.permissions.map((perm) => (
                <span key={perm} className="px-2 py-1 rounded-lg bg-white/5 text-slate-300 text-xs font-mono">
                  {perm}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* App info */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-slate-500/20">
              <Info className="w-5 h-5 text-slate-400" />
            </div>
            <h2 className="font-medium text-white">O aplikacji</h2>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Wersja</span>
              <span className="text-slate-300 font-mono">1.0.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Środowisko</span>
              <span className="text-slate-300 font-mono">{import.meta.env.MODE}</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || !password) {
      toast.error('Wprowadz numer telefonu i haslo');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login(phone, password);
      setAuth(response.user, response.accessToken, response.refreshToken);
      toast.success(`Witaj, ${response.user.name}!`);
      navigate('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Blad logowania');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 safe-area-top safe-area-bottom relative overflow-hidden">
      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-pink w-[500px] h-[500px] -top-48 -right-48 animate-float" style={{ animationDelay: '0s' }} />
        <div className="bg-orb bg-orb-purple w-[400px] h-[400px] top-1/2 -left-48 animate-float" style={{ animationDelay: '1s' }} />
        <div className="bg-orb bg-orb-blue w-[350px] h-[350px] -bottom-32 right-1/4 animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-md animate-fade-in relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-block mb-6 animate-float">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-pink-500/30 to-purple-500/30 blur-xl" />
              <img
                src="/logo.png"
                alt="eBukieteria"
                className="relative w-24 h-24 object-contain rounded-3xl"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden w-24 h-24 rounded-3xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                <Package className="w-12 h-12 text-pink-400" />
              </div>
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2">
            <span className="text-gradient">WMS</span>
          </h1>
          <p className="text-white/60 text-lg">eBukieteria.pl</p>
        </div>

        {/* Login form */}
        <div className="glass-card-ios p-8 animate-scale-in">
          <h2 className="text-xl font-semibold text-white/90 mb-8 text-center">
            Zaloguj sie
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-white/70 mb-2 ml-1">
                Numer telefonu
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl glass-input text-white placeholder-white/30 focus:outline-none transition-all text-lg"
                placeholder="+48 000 000 001"
                autoComplete="tel"
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/70 mb-2 ml-1">
                Haslo
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 pr-14 rounded-2xl glass-input text-white placeholder-white/30 focus:outline-none transition-all text-lg"
                  placeholder="********"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-6 h-6" />
                  ) : (
                    <Eye className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-6 rounded-2xl glass-button text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mt-8"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Logowanie...
                </>
              ) : (
                'Zaloguj sie'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-white/30 text-center mb-3">Dane testowe:</p>
            <div className="space-y-1 text-xs text-white/40 text-center font-mono">
              <p>+48000000001 / admin123</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-white/30 mt-8">
          WMS eBukieteria v1.0.0
        </p>
      </div>
    </div>
  );
}

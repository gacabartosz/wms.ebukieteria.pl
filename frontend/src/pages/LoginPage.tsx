import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('Wprowadz login i haslo');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login(username, password);
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
      {/* Video background with flowers from ebukieteria.pl */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute w-full h-full object-cover"
        >
          <source
            src="/flowers-bg.mp4"
            type="video/mp4"
          />
        </video>
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-pink-900/50 to-slate-900/70" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Subtle floating accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
        <div className="absolute w-96 h-96 -top-20 -right-20 bg-pink-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute w-80 h-80 top-1/2 -left-20 bg-purple-500/15 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Noise overlay */}
      <div className="noise-overlay z-[2]" />

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
              <label htmlFor="username" className="block text-sm font-medium text-white/70 mb-2 ml-1">
                Login
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl glass-input text-white placeholder-white/30 focus:outline-none transition-all text-lg"
                autoComplete="username"
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
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-white/30 mt-8">
          WMS eBukieteria v1.0.0
        </p>
      </div>
    </div>
  );
}

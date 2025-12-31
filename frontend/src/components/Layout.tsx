import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface LayoutProps {
  title: string;
  children: React.ReactNode;
  showBack?: boolean;
  actions?: React.ReactNode;
}

export default function Layout({ title, children, showBack = true, actions }: LayoutProps) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col safe-area-top safe-area-bottom">
      {/* Header - compact for mobile */}
      <header className="glass-dark sticky top-0 z-50 px-2 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showBack && (
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 -ml-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="font-semibold text-white truncate text-sm">{title}</h1>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {actions}
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <Home className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content - compact padding */}
      <main className="flex-1 p-2 max-w-4xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}

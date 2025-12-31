import { useNavigate } from 'react-router-dom';
import {
  PackagePlus,
  PackageMinus,
  ArrowRightLeft,
  ClipboardList,
  Search,
  Users,
  Warehouse,
  MapPin,
  Package,
  Box,
  History,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import clsx from 'clsx';

interface OperationTile {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color: string;
  roles?: ('ADMIN' | 'MANAGER' | 'WAREHOUSE')[];
}

const operations: OperationTile[] = [
  {
    id: 'pz',
    title: 'Przyjecie (PZ)',
    description: 'Przyjecie towaru na magazyn',
    icon: PackagePlus,
    path: '/documents/new?type=PZ',
    color: 'from-emerald-400 to-green-600',
  },
  {
    id: 'wz',
    title: 'Wydanie (WZ)',
    description: 'Wydanie towaru z magazynu',
    icon: PackageMinus,
    path: '/documents/new?type=WZ',
    color: 'from-rose-400 to-red-600',
  },
  {
    id: 'mm',
    title: 'Przesuniecie (MM)',
    description: 'Przesuniecie miedzy lokalizacjami',
    icon: ArrowRightLeft,
    path: '/documents/new?type=MM',
    color: 'from-blue-400 to-indigo-600',
  },
  {
    id: 'inventory',
    title: 'Inwentaryzacja',
    description: 'Kontrola stanow magazynowych',
    icon: ClipboardList,
    path: '/inventory',
    color: 'from-purple-400 to-violet-600',
  },
  {
    id: 'search',
    title: 'Szukaj',
    description: 'Wyszukaj produkt lub lokalizacje',
    icon: Search,
    path: '/search',
    color: 'from-cyan-400 to-teal-600',
  },
  {
    id: 'stock',
    title: 'Stan magazynu',
    description: 'Przegladaj stany magazynowe',
    icon: Package,
    path: '/stock',
    color: 'from-amber-400 to-orange-600',
  },
];

const adminOperations: OperationTile[] = [
  {
    id: 'users',
    title: 'Uzytkownicy',
    description: 'Zarzadzanie uzytkownikami',
    icon: Users,
    path: '/users',
    color: 'from-pink-400 to-rose-500',
    roles: ['ADMIN'],
  },
  {
    id: 'warehouses',
    title: 'Magazyny',
    description: 'Zarzadzanie magazynami',
    icon: Warehouse,
    path: '/warehouses',
    color: 'from-purple-400 to-indigo-500',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'locations',
    title: 'Lokalizacje',
    description: 'Zarzadzanie lokalizacjami',
    icon: MapPin,
    path: '/locations',
    color: 'from-blue-400 to-cyan-500',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'products',
    title: 'Produkty',
    description: 'Zarzadzanie produktami',
    icon: Package,
    path: '/products',
    color: 'from-emerald-400 to-teal-500',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'containers',
    title: 'Kuwety',
    description: 'Zarzadzanie kuwetami',
    icon: Box,
    path: '/containers',
    color: 'from-amber-400 to-orange-500',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'documents',
    title: 'Dokumenty',
    description: 'Historia dokumentow',
    icon: ClipboardList,
    path: '/documents',
    color: 'from-slate-400 to-gray-500',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'audit',
    title: 'Historia',
    description: 'Logi operacji',
    icon: History,
    path: '/audit',
    color: 'from-violet-400 to-purple-500',
    roles: ['ADMIN', 'MANAGER'],
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filterByRole = (tiles: OperationTile[]) => {
    return tiles.filter((tile) => {
      if (!tile.roles) return true;
      return user && tile.roles.includes(user.role);
    });
  };

  const filteredOperations = filterByRole(operations);
  const filteredAdminOperations = filterByRole(adminOperations);

  return (
    <div className="min-h-screen safe-area-top safe-area-bottom relative overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="bg-orb bg-orb-pink w-[400px] h-[400px] -top-32 -right-32 opacity-30" />
        <div className="bg-orb bg-orb-purple w-[300px] h-[300px] top-1/3 -left-32 opacity-30" />
        <div className="bg-orb bg-orb-blue w-[250px] h-[250px] bottom-32 right-1/4 opacity-20" />
      </div>

      {/* Noise overlay */}
      <div className="noise-overlay" />

      {/* Header - compact */}
      <header className="glass-dark sticky top-0 z-50 px-2 py-2 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-pink-500/30 to-purple-500/30 blur-md" />
              <img
                src="/logo.png"
                alt="eBukieteria"
                className="relative w-8 h-8 object-contain rounded-lg"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <div className="hidden w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center">
                <Package className="w-4 h-4 text-pink-400" />
              </div>
            </div>
            <div>
              <h1 className="font-bold text-gradient text-sm">WMS eBukieteria</h1>
              <p className="text-[10px] text-white/50">{user?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg glass hover:bg-white/10 text-white/60 hover:text-white transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg glass hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content - compact padding */}
      <main className="p-2 max-w-4xl mx-auto relative z-10">
        {/* Welcome message - compact */}
        <div className="mb-4 animate-fade-in">
          <h2 className="text-xl font-bold text-white mb-1">
            Witaj, <span className="text-gradient-pink">{user?.name?.split(' ')[0]}</span>!
          </h2>
          <p className="text-white/50 text-xs">Co chcesz dziś zrobić?</p>
        </div>

        {/* Main operations - compact */}
        <section className="mb-6">
          <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2 ml-1">
            Operacje
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {filteredOperations.map((op, index) => (
              <button
                key={op.id}
                onClick={() => navigate(op.path)}
                className={clsx(
                  'glass-card-ios p-3 text-left hover:scale-[1.03] active:scale-[0.97] transition-all duration-300',
                  'animate-slide-up group'
                )}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div
                  className={clsx(
                    'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center mb-2',
                    'shadow-lg group-hover:shadow-xl transition-shadow',
                    op.color
                  )}
                  style={{ boxShadow: `0 8px 24px ${op.color.includes('green') ? 'rgba(16, 185, 129, 0.3)' : op.color.includes('red') ? 'rgba(239, 68, 68, 0.3)' : op.color.includes('blue') ? 'rgba(59, 130, 246, 0.3)' : op.color.includes('purple') ? 'rgba(139, 92, 246, 0.3)' : op.color.includes('cyan') ? 'rgba(6, 182, 212, 0.3)' : 'rgba(245, 158, 11, 0.3)'}` }}
                >
                  <op.icon className="w-5 h-5 text-white" />
                </div>
                <h4 className="font-semibold text-white mb-0.5 text-sm">{op.title}</h4>
                <p className="text-[10px] text-white/40 line-clamp-1">{op.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Admin operations - compact */}
        {filteredAdminOperations.length > 0 && (
          <section className="mb-4">
            <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2 ml-1">
              Administracja
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {filteredAdminOperations.map((op, index) => (
                <button
                  key={op.id}
                  onClick={() => navigate(op.path)}
                  className={clsx(
                    'glass-card p-2 text-left hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2',
                    'animate-slide-up group'
                  )}
                  style={{ animationDelay: `${(filteredOperations.length + index) * 60}ms` }}
                >
                  <div className={clsx(
                    'w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0',
                    'group-hover:scale-110 transition-transform',
                    op.color
                  )}>
                    <op.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-white text-xs truncate">{op.title}</h4>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center py-3 text-white/20 text-[10px]">
          WMS eBukieteria v1.0.0
        </footer>
      </main>
    </div>
  );
}

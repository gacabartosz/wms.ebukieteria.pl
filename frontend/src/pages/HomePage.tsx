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
    title: 'Przyjęcie (PZ)',
    description: 'Przyjęcie towaru na magazyn',
    icon: PackagePlus,
    path: '/documents/new?type=PZ',
    color: 'from-green-500 to-emerald-600',
  },
  {
    id: 'wz',
    title: 'Wydanie (WZ)',
    description: 'Wydanie towaru z magazynu',
    icon: PackageMinus,
    path: '/documents/new?type=WZ',
    color: 'from-red-500 to-rose-600',
  },
  {
    id: 'mm',
    title: 'Przesunięcie (MM)',
    description: 'Przesunięcie między lokalizacjami',
    icon: ArrowRightLeft,
    path: '/documents/new?type=MM',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    id: 'inventory',
    title: 'Inwentaryzacja',
    description: 'Kontrola stanów magazynowych',
    icon: ClipboardList,
    path: '/inventory',
    color: 'from-purple-500 to-violet-600',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'search',
    title: 'Szukaj',
    description: 'Wyszukaj produkt lub lokalizację',
    icon: Search,
    path: '/search',
    color: 'from-cyan-500 to-teal-600',
  },
  {
    id: 'stock',
    title: 'Stan magazynu',
    description: 'Przeglądaj stany magazynowe',
    icon: Package,
    path: '/stock',
    color: 'from-amber-500 to-orange-600',
  },
];

const adminOperations: OperationTile[] = [
  {
    id: 'users',
    title: 'Użytkownicy',
    description: 'Zarządzanie użytkownikami',
    icon: Users,
    path: '/users',
    color: 'from-slate-500 to-slate-600',
    roles: ['ADMIN'],
  },
  {
    id: 'warehouses',
    title: 'Magazyny',
    description: 'Zarządzanie magazynami',
    icon: Warehouse,
    path: '/warehouses',
    color: 'from-slate-500 to-slate-600',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'locations',
    title: 'Lokalizacje',
    description: 'Zarządzanie lokalizacjami',
    icon: MapPin,
    path: '/locations',
    color: 'from-slate-500 to-slate-600',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'products',
    title: 'Produkty',
    description: 'Zarządzanie produktami',
    icon: Package,
    path: '/products',
    color: 'from-slate-500 to-slate-600',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'containers',
    title: 'Kuwety',
    description: 'Zarządzanie kuwetami',
    icon: Box,
    path: '/containers',
    color: 'from-slate-500 to-slate-600',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'documents',
    title: 'Dokumenty',
    description: 'Historia dokumentów',
    icon: ClipboardList,
    path: '/documents',
    color: 'from-slate-500 to-slate-600',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'audit',
    title: 'Historia',
    description: 'Logi operacji',
    icon: History,
    path: '/audit',
    color: 'from-slate-500 to-slate-600',
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
    <div className="min-h-screen safe-area-top safe-area-bottom">
      {/* Header */}
      <header className="glass-dark sticky top-0 z-50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500/20 border border-primary-500/30 flex items-center justify-center">
              <Warehouse className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h1 className="font-bold text-white">WMS</h1>
              <p className="text-xs text-slate-400">{user?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="p-4 max-w-4xl mx-auto">
        {/* Welcome message */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-1">
            Witaj, {user?.name?.split(' ')[0]}!
          </h2>
          <p className="text-slate-400">Co chcesz dziś zrobić?</p>
        </div>

        {/* Main operations */}
        <section className="mb-8">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Operacje
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filteredOperations.map((op, index) => (
              <button
                key={op.id}
                onClick={() => navigate(op.path)}
                className={clsx(
                  'glass-card p-4 text-left hover:scale-[1.02] active:scale-[0.98] transition-all duration-200',
                  'animate-slide-up'
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={clsx(
                    'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-3',
                    op.color
                  )}
                >
                  <op.icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-semibold text-white mb-1">{op.title}</h4>
                <p className="text-xs text-slate-400 line-clamp-2">{op.description}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Admin operations */}
        {filteredAdminOperations.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
              Administracja
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredAdminOperations.map((op, index) => (
                <button
                  key={op.id}
                  onClick={() => navigate(op.path)}
                  className={clsx(
                    'glass-card p-3 text-left hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-3',
                    'animate-slide-up'
                  )}
                  style={{ animationDelay: `${(filteredOperations.length + index) * 50}ms` }}
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <op.icon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-white text-sm truncate">{op.title}</h4>
                    <p className="text-xs text-slate-500 truncate">{op.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

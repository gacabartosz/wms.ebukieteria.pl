import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText, Check, X, Clock, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { documentsService } from '../services/documentsService';
import clsx from 'clsx';

const typeLabels: Record<string, { label: string; color: string }> = {
  PZ: { label: 'Przyjęcie', color: 'bg-green-500/20 text-green-400' },
  WZ: { label: 'Wydanie', color: 'bg-red-500/20 text-red-400' },
  MM: { label: 'Przesunięcie', color: 'bg-blue-500/20 text-blue-400' },
  INV_ADJ: { label: 'Korekta', color: 'bg-purple-500/20 text-purple-400' },
};

const statusIcons: Record<string, React.ReactNode> = {
  DRAFT: <Clock className="w-4 h-4 text-yellow-400" />,
  CONFIRMED: <Check className="w-4 h-4 text-green-400" />,
  CANCELLED: <X className="w-4 h-4 text-red-400" />,
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Roboczy',
  CONFIRMED: 'Potwierdzony',
  CANCELLED: 'Anulowany',
};

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    type: '',
    status: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['documents', filters],
    queryFn: () => documentsService.getDocuments({
      ...filters,
      type: filters.type || undefined,
      status: filters.status || undefined,
    }),
  });

  return (
    <Layout
      title="Dokumenty"
      actions={
        <Button
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters ? 'secondary' : 'ghost'}
          icon={<Filter className="w-4 h-4" />}
        >
          Filtry
        </Button>
      }
    >
      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-4 mb-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="">Wszystkie typy</option>
              <option value="PZ">PZ - Przyjęcie</option>
              <option value="WZ">WZ - Wydanie</option>
              <option value="MM">MM - Przesunięcie</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="">Wszystkie statusy</option>
              <option value="DRAFT">Roboczy</option>
              <option value="CONFIRMED">Potwierdzony</option>
              <option value="CANCELLED">Anulowany</option>
            </select>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Button
          variant="secondary"
          className="flex-col py-4 h-auto"
          onClick={() => navigate('/documents/new?type=PZ')}
        >
          <span className="text-green-400 text-lg font-bold">PZ</span>
          <span className="text-xs text-slate-400">Przyjęcie</span>
        </Button>
        <Button
          variant="secondary"
          className="flex-col py-4 h-auto"
          onClick={() => navigate('/documents/new?type=WZ')}
        >
          <span className="text-red-400 text-lg font-bold">WZ</span>
          <span className="text-xs text-slate-400">Wydanie</span>
        </Button>
        <Button
          variant="secondary"
          className="flex-col py-4 h-auto"
          onClick={() => navigate('/documents/new?type=MM')}
        >
          <span className="text-blue-400 text-lg font-bold">MM</span>
          <span className="text-xs text-slate-400">Przesunięcie</span>
        </Button>
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : data?.data.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Brak dokumentów</p>
          <Button
            className="mt-4"
            onClick={() => navigate('/documents/new?type=PZ')}
            icon={<Plus className="w-4 h-4" />}
          >
            Utwórz pierwszy dokument
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data.map((doc) => (
            <button
              key={doc.id}
              onClick={() => navigate(`/documents/${doc.id}`)}
              className="glass-card p-4 w-full text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', typeLabels[doc.type]?.color)}>
                    {doc.type}
                  </span>
                  <span className="font-medium text-white">{doc.number}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {statusIcons[doc.status]}
                  <span className="text-xs text-slate-400">{statusLabels[doc.status]}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  {doc.warehouse?.code} • {doc.linesCount} pozycji
                </span>
                <span className="text-slate-500 text-xs">
                  {format(new Date(doc.createdAt), 'd MMM HH:mm', { locale: pl })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Layout>
  );
}

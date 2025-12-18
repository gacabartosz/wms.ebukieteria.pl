import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History, Filter, Package, MapPin, FileText, User } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { auditService } from '../services/auditService';
import clsx from 'clsx';

const actionColors: Record<string, string> = {
  DOC_CREATE: 'bg-blue-500/20 text-blue-400',
  DOC_CONFIRM: 'bg-green-500/20 text-green-400',
  DOC_CANCEL: 'bg-red-500/20 text-red-400',
  STOCK_IN: 'bg-green-500/20 text-green-400',
  STOCK_OUT: 'bg-red-500/20 text-red-400',
  STOCK_MOVE: 'bg-blue-500/20 text-blue-400',
  STOCK_ADJ: 'bg-yellow-500/20 text-yellow-400',
  INV_START: 'bg-purple-500/20 text-purple-400',
  INV_COMPLETE: 'bg-green-500/20 text-green-400',
  INV_CANCEL: 'bg-red-500/20 text-red-400',
  USER_LOGIN: 'bg-slate-500/20 text-slate-400',
};

export default function AuditPage() {
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ action: '' });

  const { data: actionsData } = useQuery({
    queryKey: ['audit-actions'],
    queryFn: auditService.getActions,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => auditService.getAuditLogs({
      action: filters.action || undefined,
      limit: 100,
    }),
  });

  return (
    <Layout
      title="Historia operacji"
      actions={
        <Button
          size="sm"
          variant={showFilters ? 'secondary' : 'ghost'}
          onClick={() => setShowFilters(!showFilters)}
          icon={<Filter className="w-4 h-4" />}
        >
          Filtry
        </Button>
      }
    >
      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-4 mb-4 animate-fade-in">
          <select
            value={filters.action}
            onChange={(e) => setFilters({ action: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
          >
            <option value="">Wszystkie akcje</option>
            {actionsData?.data.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : data?.data.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <History className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Brak wpisów</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.data.map((log) => (
            <div key={log.id} className="glass-card p-3">
              <div className="flex items-start justify-between mb-2">
                <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', actionColors[log.action] || 'bg-slate-500/20 text-slate-400')}>
                  {log.action}
                </span>
                <span className="text-xs text-slate-500">
                  {format(new Date(log.createdAt), 'd MMM HH:mm:ss', { locale: pl })}
                </span>
              </div>

              <div className="space-y-1 text-sm">
                {log.user && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-3 h-3" />
                    <span>{log.user.name}</span>
                  </div>
                )}

                {log.product && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Package className="w-3 h-3" />
                    <span>{log.product.sku}</span>
                    {log.qty && <span className="text-white font-medium">x{log.qty}</span>}
                  </div>
                )}

                {(log.fromLocation || log.toLocation) && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <MapPin className="w-3 h-3" />
                    {log.fromLocation && <span>{log.fromLocation.barcode}</span>}
                    {log.fromLocation && log.toLocation && <span>→</span>}
                    {log.toLocation && <span>{log.toLocation.barcode}</span>}
                  </div>
                )}

                {log.document && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <FileText className="w-3 h-3" />
                    <span>{log.document.number}</span>
                  </div>
                )}

                {log.reason && (
                  <div className="text-slate-500 text-xs italic">
                    Powód: {log.reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

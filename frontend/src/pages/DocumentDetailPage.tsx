import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Check, X, Clock, User, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import toast from 'react-hot-toast';
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

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  DRAFT: { icon: <Clock className="w-4 h-4" />, label: 'Roboczy', color: 'text-yellow-400' },
  CONFIRMED: { icon: <Check className="w-4 h-4" />, label: 'Potwierdzony', color: 'text-green-400' },
  CANCELLED: { icon: <X className="w-4 h-4" />, label: 'Anulowany', color: 'text-red-400' },
};

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: document, isLoading } = useQuery({
    queryKey: ['document', id],
    queryFn: () => documentsService.getDocumentById(id!),
    enabled: !!id,
  });

  const confirmMutation = useMutation({
    mutationFn: () => documentsService.confirmDocument(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Dokument potwierdzony');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd potwierdzania');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => documentsService.cancelDocument(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document', id] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Dokument anulowany');
    },
  });

  if (isLoading) {
    return (
      <Layout title="Ładowanie...">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  if (!document) {
    return (
      <Layout title="Błąd">
        <div className="glass-card p-8 text-center">
          <p className="text-slate-400">Dokument nie znaleziony</p>
          <Button className="mt-4" onClick={() => navigate('/documents')}>
            Wróć do listy
          </Button>
        </div>
      </Layout>
    );
  }

  const status = statusConfig[document.status];
  const type = typeLabels[document.type];

  return (
    <Layout
      title={document.number}
      actions={
        document.status === 'DRAFT' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              onClick={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
            >
              Anuluj
            </Button>
            <Button
              size="sm"
              onClick={() => confirmMutation.mutate()}
              loading={confirmMutation.isPending}
            >
              Potwierdź
            </Button>
          </div>
        )
      }
    >
      {/* Document info */}
      <div className="glass-card p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={clsx('px-2 py-1 rounded text-sm font-medium', type?.color)}>
              {document.type}
            </span>
            <span className={clsx('flex items-center gap-1', status.color)}>
              {status.icon}
              <span className="text-sm">{status.label}</span>
            </span>
          </div>
          <span className="text-slate-400 text-sm">{document.warehouse?.code}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-slate-400">
            <User className="w-4 h-4" />
            <span>{document.createdBy?.name}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(document.createdAt), 'd MMM yyyy HH:mm', { locale: pl })}</span>
          </div>
          {document.confirmedBy && (
            <>
              <div className="flex items-center gap-2 text-green-400">
                <Check className="w-4 h-4" />
                <span>{document.confirmedBy.name}</span>
              </div>
              <div className="flex items-center gap-2 text-green-400">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(document.confirmedAt!), 'd MMM yyyy HH:mm', { locale: pl })}</span>
              </div>
            </>
          )}
        </div>

        {document.referenceNo && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <span className="text-slate-500 text-xs">Nr referencyjny:</span>
            <span className="text-white text-sm ml-2">{document.referenceNo}</span>
          </div>
        )}
        {document.notes && (
          <div className="mt-2">
            <span className="text-slate-500 text-xs">Uwagi:</span>
            <p className="text-slate-300 text-sm">{document.notes}</p>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="space-y-2">
        <div className="text-sm text-slate-400 px-1">
          Pozycje ({document.lines?.length || 0})
        </div>

        {document.lines?.map((line) => (
          <div key={line.id} className="glass-card p-3 flex items-center gap-3">
            {line.product.imageUrl ? (
              <img
                src={line.product.imageUrl}
                alt=""
                className="w-12 h-12 rounded-lg object-cover bg-white/5"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">{line.product.sku}</div>
              <div className="text-xs text-slate-400 truncate">{line.product.name}</div>
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                <MapPin className="w-3 h-3" />
                {line.fromLocation && <span>{line.fromLocation.barcode}</span>}
                {line.fromLocation && line.toLocation && <span> → </span>}
                {line.toLocation && <span>{line.toLocation.barcode}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-white text-lg">{line.qty}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Continue editing button for drafts */}
      {document.status === 'DRAFT' && (
        <Button
          className="w-full mt-4"
          onClick={() => navigate(`/documents/new?type=${document.type}&id=${document.id}`)}
        >
          Kontynuuj skanowanie
        </Button>
      )}
    </Layout>
  );
}

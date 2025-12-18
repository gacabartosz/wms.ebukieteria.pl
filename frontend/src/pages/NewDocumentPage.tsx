import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, MapPin, Plus, Minus, Trash2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { documentsService } from '../services/documentsService';
import { warehousesService } from '../services/warehousesService';
import type { DocumentDetail } from '../types';
import clsx from 'clsx';

const typeConfig: Record<string, { title: string; color: string; needsFrom: boolean; needsTo: boolean }> = {
  PZ: { title: 'Przyjęcie (PZ)', color: 'text-green-400', needsFrom: false, needsTo: true },
  WZ: { title: 'Wydanie (WZ)', color: 'text-red-400', needsFrom: true, needsTo: false },
  MM: { title: 'Przesunięcie (MM)', color: 'text-blue-400', needsFrom: true, needsTo: true },
};

export default function NewDocumentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const type = (searchParams.get('type') || 'PZ') as 'PZ' | 'WZ' | 'MM';
  const documentId = searchParams.get('id');

  const config = typeConfig[type];

  const [step, setStep] = useState<'select-warehouse' | 'scanning'>(documentId ? 'scanning' : 'select-warehouse');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [currentDocument, setCurrentDocument] = useState<DocumentDetail | null>(null);

  // Scanning state
  const [productCode, setProductCode] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [qty, setQty] = useState(1);

  // Load warehouses
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getWarehouses({ limit: 100 }),
  });

  // Load existing document if editing
  const { data: existingDocument } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => documentsService.getDocumentById(documentId!),
    enabled: !!documentId,
  });

  useEffect(() => {
    if (existingDocument) {
      setCurrentDocument(existingDocument);
      setSelectedWarehouse(existingDocument.warehouse.id);
      setStep('scanning');
    }
  }, [existingDocument]);

  // Create document mutation
  const createMutation = useMutation({
    mutationFn: documentsService.createDocument,
    onSuccess: (doc) => {
      setCurrentDocument(doc as unknown as DocumentDetail);
      navigate(`/documents/new?type=${type}&id=${doc.id}`, { replace: true });
      setStep('scanning');
      toast.success('Dokument utworzony');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd tworzenia dokumentu');
    },
  });

  // Add line mutation
  const addLineMutation = useMutation({
    mutationFn: (data: { productCode: string; fromLocationBarcode?: string; toLocationBarcode?: string; qty: number }) =>
      documentsService.addLine(currentDocument!.id, data),
    onSuccess: (line) => {
      setCurrentDocument((prev) => prev ? {
        ...prev,
        lines: [line, ...(prev.lines || [])],
      } : null);
      // Reset form
      setProductCode('');
      setQty(1);
      toast.success('Pozycja dodana');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd dodawania pozycji');
    },
  });

  // Delete line mutation
  const deleteLineMutation = useMutation({
    mutationFn: (lineId: string) => documentsService.deleteLine(currentDocument!.id, lineId),
    onSuccess: (_, lineId) => {
      setCurrentDocument((prev) => prev ? {
        ...prev,
        lines: prev.lines.filter((l) => l.id !== lineId),
      } : null);
      toast.success('Pozycja usunięta');
    },
  });

  // Confirm mutation
  const confirmMutation = useMutation({
    mutationFn: () => documentsService.confirmDocument(currentDocument!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Dokument potwierdzony');
      navigate('/documents');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd potwierdzania');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => documentsService.cancelDocument(currentDocument!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Dokument anulowany');
      navigate('/documents');
    },
  });

  const handleCreateDocument = () => {
    if (!selectedWarehouse) {
      toast.error('Wybierz magazyn');
      return;
    }
    createMutation.mutate({ type, warehouseId: selectedWarehouse });
  };

  const handleAddLine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productCode) {
      toast.error('Wprowadź kod produktu');
      return;
    }
    if (config.needsFrom && !fromLocation) {
      toast.error('Wprowadź lokalizację źródłową');
      return;
    }
    if (config.needsTo && !toLocation) {
      toast.error('Wprowadź lokalizację docelową');
      return;
    }

    addLineMutation.mutate({
      productCode,
      fromLocationBarcode: fromLocation || undefined,
      toLocationBarcode: toLocation || undefined,
      qty,
    });
  };

  if (step === 'select-warehouse') {
    return (
      <Layout title={config.title}>
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-white">Wybierz magazyn</h2>
          <div className="grid gap-3">
            {warehousesData?.data.map((wh) => (
              <button
                key={wh.id}
                onClick={() => setSelectedWarehouse(wh.id)}
                className={clsx(
                  'glass-card p-4 text-left transition-all',
                  selectedWarehouse === wh.id
                    ? 'ring-2 ring-primary-500 bg-primary-500/10'
                    : 'hover:bg-white/5'
                )}
              >
                <div className="font-medium text-white">{wh.code}</div>
                <div className="text-sm text-slate-400">{wh.name}</div>
              </button>
            ))}
          </div>
          <Button
            className="w-full"
            onClick={handleCreateDocument}
            loading={createMutation.isPending}
            disabled={!selectedWarehouse}
          >
            Rozpocznij
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={currentDocument?.number || config.title}
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="danger"
            onClick={() => cancelMutation.mutate()}
            loading={cancelMutation.isPending}
            icon={<X className="w-4 h-4" />}
          >
            Anuluj
          </Button>
          <Button
            size="sm"
            onClick={() => confirmMutation.mutate()}
            loading={confirmMutation.isPending}
            disabled={!currentDocument?.lines?.length}
            icon={<Check className="w-4 h-4" />}
          >
            Potwierdź
          </Button>
        </div>
      }
    >
      {/* Scanning form */}
      <form onSubmit={handleAddLine} className="glass-card p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Package className={clsx('w-5 h-5', config.color)} />
          <span className="font-medium text-white">Skanuj produkt</span>
        </div>

        <Input
          placeholder="Kod EAN lub SKU"
          value={productCode}
          onChange={(e) => setProductCode(e.target.value.toUpperCase())}
          autoFocus
        />

        {config.needsFrom && (
          <Input
            placeholder="Lokalizacja źródłowa (np. PL1-01-01-01)"
            value={fromLocation}
            onChange={(e) => setFromLocation(e.target.value.toUpperCase())}
            icon={<MapPin className="w-4 h-4" />}
          />
        )}

        {config.needsTo && (
          <Input
            placeholder="Lokalizacja docelowa (np. PL1-01-01-01)"
            value={toLocation}
            onChange={(e) => setToLocation(e.target.value.toUpperCase())}
            icon={<MapPin className="w-4 h-4" />}
          />
        )}

        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm">Ilość:</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQty(Math.max(1, qty - 1))}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-center"
              min={1}
            />
            <button
              type="button"
              onClick={() => setQty(qty + 1)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <Button
            type="submit"
            className="ml-auto"
            loading={addLineMutation.isPending}
            icon={<Plus className="w-4 h-4" />}
          >
            Dodaj
          </Button>
        </div>
      </form>

      {/* Lines list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-slate-400 px-1">
          <span>Pozycje ({currentDocument?.lines?.length || 0})</span>
        </div>

        {!currentDocument?.lines?.length ? (
          <div className="glass-card p-6 text-center">
            <Package className="w-10 h-10 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Brak pozycji</p>
            <p className="text-slate-500 text-xs">Zeskanuj produkt aby dodać</p>
          </div>
        ) : (
          currentDocument.lines.map((line) => (
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
                <div className="text-xs text-slate-500">
                  {line.fromLocation && <span>{line.fromLocation.barcode}</span>}
                  {line.fromLocation && line.toLocation && <span> → </span>}
                  {line.toLocation && <span>{line.toLocation.barcode}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-white">{line.qty}</div>
                <button
                  onClick={() => deleteLineMutation.mutate(line.id)}
                  className="text-red-400 hover:text-red-300 p-1"
                  disabled={deleteLineMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}

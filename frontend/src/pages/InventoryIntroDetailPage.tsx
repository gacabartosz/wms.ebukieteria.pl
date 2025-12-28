import { useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Camera,
  Check,
  Trash2,
  MapPin,
  Package,
  AlertCircle,
  Minus,
  Plus,
  Edit2,
  User,
  X,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

// Lokalny słownik nazw produktów - NIE OBCIĄŻA SYSTEMU (statyczna lista)
const PRODUCT_NAME_SUGGESTIONS = [
  // Kwiaty cięte
  'Róża', 'Tulipan', 'Goździk', 'Gerbera', 'Lilia', 'Chryzantema', 'Słonecznik', 'Frezja', 'Irys', 'Piwonia',
  // Kwiaty doniczkowe
  'Storczyk', 'Skrzydłokwiat', 'Anturium', 'Fikus', 'Monstera', 'Sansewieria', 'Kalanchoe', 'Begonia', 'Fiołek afrykański',
  // Rośliny zielone
  'Paproć', 'Bluszcz', 'Palma', 'Dracena', 'Juka', 'Zamiokulkas', 'Aloes',
  // Doniczki
  'Doniczka ceramiczna', 'Doniczka plastikowa', 'Doniczka betonowa', 'Doniczka rattanowa', 'Doniczka z podstawką', 'Osłonka',
  // Wazony
  'Wazon szklany', 'Wazon ceramiczny', 'Wazon kryształowy', 'Wazon metalowy',
  // Ozdoby
  'Ozdoba świąteczna', 'Ozdoba wielkanocna', 'Wstążka', 'Siatka florystyczna', 'Rafia',
  // Akcesoria
  'Gąbka florystyczna', 'Drut florystyczny', 'Sekator', 'Taśma', 'Koszyk',
  // Kompozycje
  'Bukiet mieszany', 'Kompozycja w koszu', 'Wieniec', 'Wiązanka',
  // Inne
  'Ziemia', 'Nawóz', 'Zestaw narzędzi',
].sort();
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { inventoryIntroService, InventoryIntroLine } from '../services/inventoryIntroService';
import { useAuthStore } from '../store/authStore';
import { playBeep, playClickBeep } from '../utils/sounds';
import { compressCameraImage } from '../utils/imageCompression';
import clsx from 'clsx';
import api from '../services/api';

export default function InventoryIntroDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const priceInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // Export state
  const [exporting, setExporting] = useState(false);

  // Form state
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [productName, setProductName] = useState<string>('');
  const [showNameSuggestions, setShowNameSuggestions] = useState<boolean>(false);
  const [priceBrutto, setPriceBrutto] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>('szt');
  const [ean, setEan] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Filtruj sugestie nazw - lokalne, bez API
  const filteredNameSuggestions = useMemo(() => {
    if (!productName || productName.length < 1) return [];
    const search = productName.toLowerCase();
    return PRODUCT_NAME_SUGGESTIONS
      .filter((name) => name.toLowerCase().startsWith(search))
      .slice(0, 8);
  }, [productName]);

  // Edit state
  const [editingLine, setEditingLine] = useState<InventoryIntroLine | null>(null);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editPrice, setEditPrice] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editEan, setEditEan] = useState<string>('');
  const [showEditNameSuggestions, setShowEditNameSuggestions] = useState<boolean>(false);

  // Filtruj sugestie nazw dla edycji
  const filteredEditNameSuggestions = useMemo(() => {
    if (!editName || editName.length < 1) return [];
    const search = editName.toLowerCase();
    return PRODUCT_NAME_SUGGESTIONS
      .filter((name) => name.toLowerCase().startsWith(search))
      .slice(0, 8);
  }, [editName]);

  // Fetch inventory data
  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory-intro', id],
    queryFn: () => inventoryIntroService.getById(id!),
    enabled: !!id,
  });

  // Fetch summary for complete modal
  const { data: summary } = useQuery({
    queryKey: ['inventory-intro-summary', id],
    queryFn: () => inventoryIntroService.getSummary(id!),
    enabled: showCompleteModal && !!id,
  });

  // Add line mutation
  const addLineMutation = useMutation({
    mutationFn: (data: {
      imageUrl: string;
      priceBrutto: number;
      quantity: number;
      unit: string;
      ean?: string;
      name?: string;
    }) => inventoryIntroService.addLine(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intro', id] });
      playBeep('success');
      toast.success('Produkt dodany!');
      resetForm();
      // Focus price input for next entry
      setTimeout(() => priceInputRef.current?.focus(), 100);
    },
    onError: (error: any) => {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Blad dodawania');
    },
  });

  // Delete line mutation
  const deleteLineMutation = useMutation({
    mutationFn: (lineId: string) => inventoryIntroService.deleteLine(id!, lineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intro', id] });
      toast.success('Usunieto');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Blad usuwania');
    },
  });

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: () => inventoryIntroService.complete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intro'] });
      playBeep('success');
      toast.success('Inwentaryzacja zakonczona! Produkty utworzone.');
      navigate('/inventory');
    },
    onError: (error: any) => {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Blad zakonczenia');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => inventoryIntroService.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intro'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-intro', id] });
      toast.success('Inwentaryzacja anulowana');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Blad anulowania');
    },
  });

  // Uncancel mutation (ADMIN only)
  const uncancelMutation = useMutation({
    mutationFn: () => inventoryIntroService.uncancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intro'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-intro', id] });
      toast.success('Cofnieto anulowanie - inwentaryzacja wznowiona');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Blad cofania anulowania');
    },
  });

  // Export to Excel
  const handleExportExcel = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const response = await api.post('/inventory-intro/export/excel',
        { inventoryIds: [id], vatRate: 23 },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inwentaryzacja_${id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Pobrano plik Excel');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Blad eksportu');
    } finally {
      setExporting(false);
    }
  };

  // Export to PDF with images
  const handleExportPDF = async () => {
    if (!id) return;
    setExporting(true);
    try {
      const response = await api.post('/inventory-intro/export/pdf',
        { inventoryIds: [id], vatRate: 23 },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inwentaryzacja_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Pobrano plik PDF ze zdjeciami');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Blad eksportu PDF');
    } finally {
      setExporting(false);
    }
  };

  // Update line mutation
  const updateLineMutation = useMutation({
    mutationFn: (data: { lineId: string; quantity?: number; priceBrutto?: number; name?: string; ean?: string }) =>
      inventoryIntroService.updateLine(id!, data.lineId, {
        quantity: data.quantity,
        priceBrutto: data.priceBrutto,
        name: data.name,
        ean: data.ean,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intro', id] });
      playBeep('success');
      toast.success('Zaktualizowano!');
      setEditingLine(null);
    },
    onError: (error: any) => {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Blad aktualizacji');
    },
  });

  const resetForm = () => {
    setImageUrl('');
    setImagePreview('');
    setProductName('');
    setPriceBrutto('');
    setQuantity(1);
    setUnit('szt');
    setEan('');
    setError('');
  };

  const openEditModal = (line: InventoryIntroLine) => {
    setEditingLine(line);
    setEditQuantity(line.quantity);
    setEditPrice(String(line.priceBrutto));
    setEditName(line.tempName || '');
    setEditEan(line.ean || '');
  };

  const handleEditSubmit = () => {
    if (!editingLine) return;

    const price = parseFloat(editPrice.replace(',', '.'));
    if (isNaN(price) || price <= 0) {
      toast.error('Podaj prawidlowa cene!');
      return;
    }

    if (editQuantity < 1) {
      toast.error('Ilosc musi byc co najmniej 1');
      return;
    }

    playClickBeep();
    updateLineMutation.mutate({
      lineId: editingLine.id,
      quantity: editQuantity,
      priceBrutto: price,
      name: editName || undefined,
      ean: editEan || undefined,
    });
  };

  // Handle camera/file input with compression
  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setError('');

    try {
      // Kompresuj obraz (640x640, ~80KB)
      const compressed = await compressCameraImage(file);
      setImagePreview(compressed);
      setImageUrl(compressed);
      // Auto-focus na cene po zrobieniu zdjecia
      setTimeout(() => priceInputRef.current?.focus(), 100);
    } catch (err) {
      console.error('Compression error:', err);
      setError('Blad kompresji zdjecia');
      playBeep('error');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!imageUrl) {
      setError('Zdjecie jest wymagane!');
      playBeep('error');
      return;
    }

    const price = parseFloat(priceBrutto.replace(',', '.'));
    if (isNaN(price) || price <= 0) {
      setError('Podaj prawidlowa cene!');
      playBeep('error');
      return;
    }

    if (quantity < 1) {
      setError('Ilosc musi byc co najmniej 1');
      playBeep('error');
      return;
    }

    addLineMutation.mutate({
      imageUrl,
      priceBrutto: price,
      quantity,
      unit,
      ean: ean || undefined,
      name: productName || undefined,
    });
  };

  const handleQuantityChange = (delta: number) => {
    playClickBeep();
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  if (isLoading) {
    return (
      <Layout title="Ladowanie...">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-white/10 rounded-xl" />
          <div className="h-12 bg-white/10 rounded-xl" />
          <div className="h-12 bg-white/10 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!inventory) {
    return (
      <Layout title="Blad">
        <div className="glass-card p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-400">Nie znaleziono inwentaryzacji</p>
        </div>
      </Layout>
    );
  }

  const isInProgress = inventory.status === 'IN_PROGRESS';
  const isCancelled = inventory.status === 'CANCELLED';

  return (
    <Layout
      title={inventory.name}
      actions={
        <div className="flex gap-1">
          {/* Export buttons - icons only for compact header */}
          {inventory.lines.length > 0 && (
            <>
              <button
                onClick={handleExportExcel}
                disabled={exporting}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-green-400 transition-colors disabled:opacity-50"
                title="Excel (XLS)"
              >
                <FileSpreadsheet className="w-5 h-5" />
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                title="PDF ze zdjeciami"
              >
                <FileText className="w-5 h-5" />
              </button>
            </>
          )}
          {/* ADMIN actions */}
          {isAdmin && (
            <>
              {/* Cancel - only in progress, only ADMIN */}
              {isInProgress && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => cancelMutation.mutate()}
                    loading={cancelMutation.isPending}
                  >
                    Anuluj
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setShowCompleteModal(true)}
                    disabled={inventory.lines.length === 0}
                  >
                    Zakoncz
                  </Button>
                </>
              )}
              {/* Uncancel - only cancelled, only ADMIN */}
              {isCancelled && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => uncancelMutation.mutate()}
                  loading={uncancelMutation.isPending}
                >
                  Cofnij anulowanie
                </Button>
              )}
            </>
          )}
        </div>
      }
    >
      {/* Header info */}
      <div className="glass-card p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-primary-400" />
          <span className="text-slate-300">{inventory.defaultLocationBarcode}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Package className="w-4 h-4 text-green-400" />
          <span className="text-white font-medium">{inventory.lines.length}</span>
          <span className="text-slate-400">produktow</span>
        </div>
      </div>

      {isInProgress && (
        <form onSubmit={handleSubmit} className="pb-28 sm:pb-4">
          {/* All fields in one glass-card */}
          <div className="glass-card p-4 space-y-4">
          {/* Image capture - always camera */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Zdjecie <span className="text-red-400">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              onChange={handleImageCapture}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing}
              className={clsx(
                'w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all',
                imagePreview
                  ? 'border-green-500/50 bg-green-500/5'
                  : 'border-white/20 bg-white/5 hover:border-primary-500/50 hover:bg-primary-500/5',
                isCompressing && 'opacity-50 cursor-wait'
              )}
            >
              {isCompressing ? (
                <>
                  <div className="w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-1" />
                  <span className="text-slate-400 text-xs">Kompresowanie...</span>
                </>
              ) : imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-slate-400 mb-1" />
                  <span className="text-slate-400 text-xs">Zrob zdjecie</span>
                </>
              )}
            </button>
            {imagePreview && (
              <button
                type="button"
                onClick={() => {
                  setImagePreview('');
                  setImageUrl('');
                }}
                className="mt-2 text-sm text-red-400 hover:text-red-300"
              >
                Usun zdjecie
              </button>
            )}
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Cena brutto (zl) <span className="text-red-400">*</span>
            </label>
            <input
              ref={priceInputRef}
              type="text"
              inputMode="decimal"
              value={priceBrutto}
              onChange={(e) => setPriceBrutto(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-4 text-2xl font-bold rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Ilosc</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleQuantityChange(-1)}
                disabled={quantity <= 1}
                className="w-14 h-14 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
              >
                <Minus className="w-6 h-6" />
              </button>
              <div className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="text-2xl font-bold text-white">{quantity}</span>
              </div>
              <button
                type="button"
                onClick={() => handleQuantityChange(1)}
                className="w-14 h-14 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Jednostka</label>
            <div className="flex gap-2">
              {['szt', 'kg', 'opak'].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={clsx(
                    'flex-1 py-3 rounded-xl font-medium transition-all',
                    unit === u
                      ? 'bg-primary-500 text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  )}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Product name (optional) - with autocomplete */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Nazwa <span className="text-slate-500 text-xs font-normal">(opcjonalnie)</span>
            </label>
            {/* Quick name buttons - most common */}
            <div className="flex flex-wrap gap-2 mb-3">
              {['Doniczka', 'Ozdoba', 'Kwiat zywy', 'Inne'].map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setProductName(name)}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                    productName === name
                      ? 'bg-primary-500 text-white'
                      : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                ref={nameInputRef}
                type="text"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  setShowNameSuggestions(true);
                }}
                onFocus={() => setShowNameSuggestions(true)}
                onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
                placeholder="Wpisz lub wybierz ze slownika..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
              />
              {/* Autocomplete dropdown */}
              {showNameSuggestions && filteredNameSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 rounded-xl bg-slate-800 border border-white/20 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {filteredNameSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setProductName(suggestion);
                        setShowNameSuggestions(false);
                      }}
                      className="w-full px-4 py-3 text-left text-white hover:bg-primary-500/20 transition-colors border-b border-white/5 last:border-b-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* EAN (optional) - at the end */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              EAN <span className="text-slate-500 text-xs font-normal">(opcjonalnie)</span>
            </label>
            <input
              type="text"
              value={ean}
              onChange={(e) => setEan(e.target.value)}
              placeholder="Kod kreskowy"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Submit button inside card on desktop */}
          <div className="hidden sm:block pt-2">
            <Button
              type="submit"
              className="w-full py-5 text-xl font-bold"
              icon={<Check className="w-6 h-6" />}
              loading={addLineMutation.isPending}
            >
              ZAPISZ PRODUKT
            </Button>
          </div>
          </div>{/* End of glass-card */}

          {/* Submit button - fixed on mobile */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent sm:hidden z-50">
            <Button
              type="submit"
              className="w-full py-5 text-xl font-bold"
              icon={<Check className="w-6 h-6" />}
              loading={addLineMutation.isPending}
            >
              ZAPISZ PRODUKT
            </Button>
          </div>

          {/* Spacer for fixed button on mobile */}
          <div className="h-24 sm:hidden" />
        </form>
      )}

      {/* Added products list */}
      {inventory.lines.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-400 mb-3">
            Ostatnio dodane ({inventory.lines.length}):
          </h3>
          <div className="space-y-2">
            {inventory.lines.map((line: InventoryIntroLine) => (
              <div
                key={line.id}
                className={clsx(
                  'glass-card p-3 flex items-center gap-3',
                  isInProgress && 'cursor-pointer hover:bg-white/10 transition-colors'
                )}
                onClick={() => isInProgress && openEditModal(line)}
              >
                {line.imageUrl && (
                  <img
                    src={line.imageUrl}
                    alt={line.tempName}
                    className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate">{line.tempName}</div>
                  <div className="text-sm text-slate-400">
                    {Number(line.priceBrutto).toFixed(2)} zl | {line.quantity} {line.unit}
                  </div>
                  {/* Show who added and when */}
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    {line.createdBy && (
                      <>
                        <User className="w-3 h-3" />
                        <span>{line.createdBy.name}</span>
                      </>
                    )}
                    {line.createdAt && (
                      <span>
                        {format(new Date(line.createdAt), 'dd.MM HH:mm', { locale: pl })}
                      </span>
                    )}
                  </div>
                </div>
                {isInProgress && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(line);
                      }}
                      className="p-2 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLineMutation.mutate(line.id);
                      }}
                      disabled={deleteLineMutation.isPending}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingLine && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Edytuj produkt</h3>
              <button
                onClick={() => setEditingLine(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product image preview */}
            {editingLine.imageUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={editingLine.imageUrl}
                  alt={editingLine.tempName}
                  className="w-24 h-24 object-cover rounded-xl"
                />
              </div>
            )}

            {/* Edit Price */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Cena brutto (zl)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full px-4 py-3 text-xl font-bold rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
              />
            </div>

            {/* Edit Quantity */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Ilosc</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playClickBeep();
                    setEditQuantity((prev) => Math.max(1, prev - 1));
                  }}
                  disabled={editQuantity <= 1}
                  className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
                  <span className="text-xl font-bold text-white">{editQuantity}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playClickBeep();
                    setEditQuantity((prev) => prev + 1);
                  }}
                  className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Edit Name - before EAN - with autocomplete */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nazwa <span className="text-slate-500">(opcjonalnie - slownik)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setShowEditNameSuggestions(true);
                  }}
                  onFocus={() => setShowEditNameSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowEditNameSuggestions(false), 200)}
                  placeholder="Wpisz lub wybierz..."
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
                />
                {/* Autocomplete dropdown */}
                {showEditNameSuggestions && filteredEditNameSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 rounded-xl bg-slate-800 border border-white/20 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {filteredEditNameSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setEditName(suggestion);
                          setShowEditNameSuggestions(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-white hover:bg-primary-500/30 transition-colors border-b border-white/5 last:border-b-0"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Edit EAN - at the end */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                EAN <span className="text-slate-500">(opcjonalnie)</span>
              </label>
              <input
                type="text"
                value={editEan}
                onChange={(e) => setEditEan(e.target.value)}
                placeholder="Kod kreskowy"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setEditingLine(null)}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button
                onClick={handleEditSubmit}
                loading={updateLineMutation.isPending}
                className="flex-1"
                icon={<Check className="w-5 h-5" />}
              >
                Zapisz
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md animate-fade-in">
            <h3 className="text-lg font-bold text-white mb-4">Zakonczyc inwentaryzacje?</h3>

            {summary && (
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Liczba produktow:</span>
                  <span className="text-white font-medium">{summary.summary.productsCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Laczna ilosc:</span>
                  <span className="text-white font-medium">{summary.summary.totalQuantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Wartosc brutto:</span>
                  <span className="text-green-400 font-bold">{summary.summary.totalValue} zl</span>
                </div>
              </div>
            )}

            <p className="text-slate-400 text-sm mb-6">
              Po zakonczeniu zostan utworzone produkty i stany magazynowe. Tej operacji nie mozna cofnac.
            </p>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setShowCompleteModal(false)}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button
                onClick={() => completeMutation.mutate()}
                loading={completeMutation.isPending}
                className="flex-1"
                icon={<Check className="w-5 h-5" />}
              >
                Zakoncz
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

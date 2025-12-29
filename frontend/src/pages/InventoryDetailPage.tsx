import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Package, Check, Box, Minus, Plus, Search, Edit2, Trash2, User, X, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { inventoryService } from '../services/inventoryService';
import { containersService } from '../services/containersService';
import { productsService } from '../services/productsService';
import { playBeep, playLocationBeep, playClickBeep } from '../utils/sounds';
import { useAuthStore } from '../store/authStore';
import clsx from 'clsx';

// Debounce hook for product search
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

type Step = 'scan-location' | 'scan-products' | 'completed';

interface ScannedProduct {
  code: string;
  sku: string;
  name: string;
  qty: number;
  priceBrutto: number | null;
  priceNetto: number | null;
  scannedBy: string;
  scannedAt: Date;
  lineId?: string; // ID linii w bazie (po zapisie)
  productId?: string; // ID produktu w bazie
}

interface PendingProduct {
  code: string;
  sku: string;
  name: string;
  productId: string;
  priceBrutto: number | null;
  priceNetto: number | null;
}

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('scan-location');
  const [currentLocation, setCurrentLocation] = useState<{ id: string; barcode: string; zone?: string } | null>(null);
  const [currentContainer, setCurrentContainer] = useState<{ id: string; barcode: string; name?: string } | null>(null);
  const [scannedProducts, setScannedProducts] = useState<ScannedProduct[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [completedLocations, setCompletedLocations] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const autoSubmitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastInputTimeRef = useRef<number>(0);
  const inputLengthBeforeRef = useRef<number>(0);

  // Pending product states - product waits for quantity input before saving
  const [pendingProduct, setPendingProduct] = useState<PendingProduct | null>(null);
  const [pendingQty, setPendingQty] = useState<number>(1);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  // Auth store for user info
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<ScannedProduct | null>(null);
  const [editQty, setEditQty] = useState<number>(1);
  const [editPriceNetto, setEditPriceNetto] = useState<string>('');
  const [editPriceBrutto, setEditPriceBrutto] = useState<string>('');

  // Admin panel state
  const [showAdminPanel, setShowAdminPanel] = useState<boolean>(false);

  // Product search autocomplete
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const debouncedSearch = useDebounce(inputValue, 300);

  // Query for product autocomplete (only when typing manually, not scanning)
  const { data: searchResults } = useQuery({
    queryKey: ['products-autocomplete', debouncedSearch],
    queryFn: () => productsService.searchAutocomplete(debouncedSearch),
    enabled: step === 'scan-products' && debouncedSearch.length >= 2 && showSearchDropdown,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Helper to clear input and reset scanner detection
  const clearInput = useCallback(() => {
    setInputValue('');
    inputLengthBeforeRef.current = 0;
    lastInputTimeRef.current = 0;
    setShowSearchDropdown(false);
  }, []);


  // Save pending product to backend
  const savePendingProduct = useCallback(async () => {
    if (!pendingProduct || !currentLocation) return;

    try {
      const result = await addLineMutation.mutateAsync({
        locationBarcode: currentLocation.barcode,
        productCode: pendingProduct.code,
        countedQty: pendingQty,
      });

      // Add to scanned list with full info
      setScannedProducts(prev => [
        ...prev,
        {
          code: pendingProduct.code,
          sku: pendingProduct.sku,
          name: pendingProduct.name,
          qty: pendingQty,
          priceBrutto: pendingProduct.priceBrutto,
          priceNetto: pendingProduct.priceNetto,
          scannedBy: user?.name || 'Nieznany',
          scannedAt: new Date(),
          lineId: result?.id,
        },
      ]);

      // Clear pending state
      setPendingProduct(null);
      setPendingQty(1);
      playBeep('success');
    } catch {
      playBeep('error');
      // Error handled in mutation
    }
  }, [pendingProduct, currentLocation, pendingQty, user]);

  // Handle Enter key on quantity input
  const handleQtyKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      savePendingProduct();
      // Focus back to scanner input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [savePendingProduct]);

  // Handle quantity change
  const handleQtyChange = useCallback((value: number) => {
    setPendingQty(Math.max(1, value));
  }, []);

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory', id],
    queryFn: () => inventoryService.getInventoryCountById(id!),
    enabled: !!id,
  });

  // Check if inventory is in progress (editable)
  const isInProgress = inventory?.status === 'IN_PROGRESS';

  // Focus input on mount and step change
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [step, currentLocation]);

  const addLineMutation = useMutation({
    mutationFn: (data: { locationBarcode: string; productCode: string; countedQty: number }) =>
      inventoryService.addLine(id!, data),
    onError: (error: any) => {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Produkt nie znaleziony');
    },
  });

  const updateLineMutation = useMutation({
    mutationFn: (data: { lineId: string; countedQty: number }) =>
      inventoryService.updateLine(id!, data.lineId, { countedQty: data.countedQty }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', id] });
      playBeep('success');
      toast.success('Ilość zaktualizowana');
    },
    onError: (error: any) => {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Błąd aktualizacji');
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: (lineId: string) => inventoryService.deleteLine(id!, lineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', id] });
      playBeep('success');
      toast.success('Pozycja usunięta');
    },
    onError: (error: any) => {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Błąd usuwania');
    },
  });

  // Mutation for updating product prices
  const updateProductPriceMutation = useMutation({
    mutationFn: (data: { productId: string; priceNetto?: number | null; priceBrutto?: number | null }) =>
      productsService.updateProduct(data.productId, {
        priceNetto: data.priceNetto,
        priceBrutto: data.priceBrutto,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', id] });
      toast.success('Ceny zaktualizowane');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd aktualizacji cen');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => inventoryService.completeInventoryCount(id!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      playBeep('success');
      toast.success(`Inwentaryzacja zakończona! Korekt: ${result.adjustmentsCount}`);
      navigate('/inventory');
    },
    onError: (error: any) => {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Błąd zakończenia');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => inventoryService.cancelInventoryCount(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inwentaryzacja anulowana');
      navigate('/inventory');
    },
  });

  // Handle selecting product from autocomplete dropdown
  const handleSelectProduct = async (product: { id: string; sku: string; ean: string | null; name: string; priceBrutto?: number | null }) => {
    setShowSearchDropdown(false);
    setInputValue('');

    // If there's a pending product, save it first
    if (pendingProduct && currentLocation) {
      await savePendingProduct();
    }

    // Get full product info with price
    try {
      const fullProduct = await productsService.getProductByCode(product.ean || product.sku);

      // Set selected product as pending with price
      setPendingProduct({
        code: product.ean || product.sku,
        sku: product.sku,
        name: product.name,
        productId: product.id,
        priceBrutto: fullProduct.priceBrutto ? Number(fullProduct.priceBrutto) : null,
        priceNetto: fullProduct.priceNetto ? Number(fullProduct.priceNetto) : null,
      });
      setPendingQty(1);

      // Focus on quantity input
      setTimeout(() => qtyInputRef.current?.focus(), 100);
      playBeep('success');
    } catch {
      // Fallback without price
      setPendingProduct({
        code: product.ean || product.sku,
        sku: product.sku,
        name: product.name,
        productId: product.id,
        priceBrutto: null,
        priceNetto: null,
      });
      setPendingQty(1);
      setTimeout(() => qtyInputRef.current?.focus(), 100);
      playBeep('success');
    }
  };

  // Handle location scan
  const handleLocationScan = async (barcode: string) => {
    try {
      const result = await inventoryService.getLocationForCounting(id!, barcode);
      setCurrentLocation({
        id: result.location.id,
        barcode: result.location.barcode,
        zone: result.location.zone,
      });
      // Set container if returned (only when scanning container with assigned location)
      if (result.container) {
        setCurrentContainer({
          id: result.container.id,
          barcode: result.container.barcode,
          name: result.container.name,
        });
      } else {
        setCurrentContainer(null);
      }
      setScannedProducts([]);
      setStep('scan-products');
      playLocationBeep();
      clearInput();
    } catch (error: any) {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Lokalizacja nie znaleziona');
      clearInput();
    }
  };

  // Handle container assignment during product scanning
  const handleContainerScan = async (containerBarcode: string) => {
    if (!currentLocation) return;

    try {
      // Try to get or create container and assign to current location
      let container;
      try {
        container = await containersService.getContainerByBarcode(containerBarcode);
      } catch {
        // Container doesn't exist - create it with current location
        container = await containersService.createContainer({
          barcode: containerBarcode,
          locationBarcode: currentLocation.barcode,
        });
        toast.success(`Utworzono kuwetę ${containerBarcode}`);
      }

      // If container exists but has different location, move it
      if (container.location?.barcode !== currentLocation.barcode) {
        await containersService.moveContainer(container.id, currentLocation.barcode);
        toast.success(`Kuweta ${containerBarcode} przeniesiona na ${currentLocation.barcode}`);
      }

      setCurrentContainer({
        id: container.id,
        barcode: containerBarcode,
        name: container.name,
      });

      playLocationBeep();
      clearInput();
    } catch (error: any) {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Błąd przypisywania kuwety');
      clearInput();
    }
  };

  // Handle product scan - NEW FLOW: product waits as pending until qty entered or next scan
  const handleProductScan = async (code: string) => {
    if (!currentLocation) return;

    // Check if this is a container barcode (starts with K followed by digits)
    if (/^K\d+$/i.test(code)) {
      // Save pending product first if exists
      if (pendingProduct) {
        await savePendingProduct();
      }
      await handleContainerScan(code);
      return;
    }

    // If there's a pending product, save it first with current qty
    if (pendingProduct) {
      await savePendingProduct();
    }

    // Get product info without saving (just validation)
    try {
      const productInfo = await productsService.getProductByCode(code);

      // Set as new pending product with price
      setPendingProduct({
        code: code,
        sku: productInfo.sku,
        name: productInfo.name,
        productId: productInfo.id,
        priceBrutto: productInfo.priceBrutto ? Number(productInfo.priceBrutto) : null,
        priceNetto: productInfo.priceNetto ? Number(productInfo.priceNetto) : null,
      });
      setPendingQty(1);

      // Focus on quantity input
      setTimeout(() => qtyInputRef.current?.focus(), 100);

      playBeep('success');
      clearInput();
    } catch (error: any) {
      playBeep('error');
      toast.error(error.response?.data?.error || 'Produkt nie znaleziony');
      clearInput();
    }
  };

  // Process scanned code
  const processCode = useCallback(async (code: string) => {
    if (isProcessing || !code) return;
    setIsProcessing(true);

    try {
      if (step === 'scan-location') {
        await handleLocationScan(code);
      } else if (step === 'scan-products') {
        await handleProductScan(code);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [step, isProcessing, currentLocation]);

  // Handle input change with auto-submit for scanner
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase();
    const now = Date.now();
    const timeSinceLastInput = now - lastInputTimeRef.current;
    const charsAdded = value.length - inputLengthBeforeRef.current;

    setInputValue(value);
    lastInputTimeRef.current = now;
    inputLengthBeforeRef.current = value.length;

    // Clear existing timer
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }

    // Detect scanner input: many characters added at once (like paste)
    // Scanner typically sends whole barcode in one "burst" - 5+ chars in single event
    // or rapid successive inputs (< 50ms between chars)
    const isScannerInput = charsAdded >= 5 || (charsAdded > 0 && timeSinceLastInput < 50 && value.length >= 8);

    if (isScannerInput && value.trim().length >= 8) {
      // Scanner detected - auto-submit after short delay to catch any trailing chars
      setShowSearchDropdown(false);  // Hide dropdown for scanner input
      autoSubmitTimerRef.current = setTimeout(() => {
        processCode(value.trim());
      }, 100);
    } else {
      // Manual typing - show dropdown for product search
      if (step === 'scan-products' && value.length >= 2) {
        setShowSearchDropdown(true);
      } else {
        setShowSearchDropdown(false);
      }
    }
  }, [processCode, step]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
      }
    };
  }, []);

  // Handle manual submit (Enter key)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clear auto-submit timer since user pressed Enter
    if (autoSubmitTimerRef.current) {
      clearTimeout(autoSubmitTimerRef.current);
    }
    const value = inputValue.trim().toUpperCase();
    if (!value) return;
    processCode(value);
  };

  // Finish current location
  const handleFinishLocation = async () => {
    // Save pending product first if exists
    if (pendingProduct) {
      await savePendingProduct();
    }

    if (currentLocation) {
      const label = currentContainer
        ? `Kuweta ${currentContainer.barcode}`
        : `Lokalizacja ${currentLocation.barcode}`;
      setCompletedLocations([...completedLocations, currentContainer?.barcode || currentLocation.barcode]);
      playBeep('warning');
      toast.success(`${label} zakończona`);
    }
    setCurrentLocation(null);
    setCurrentContainer(null);
    setScannedProducts([]);
    setPendingProduct(null);
    setPendingQty(1);
    setStep('scan-location');
    clearInput();
  };

  // Finish entire inventory
  const handleFinishInventory = async () => {
    // Save pending product first if exists
    if (pendingProduct) {
      await savePendingProduct();
    }

    if (completedLocations.length === 0 && scannedProducts.length === 0 && !pendingProduct) {
      toast.error('Brak zeskanowanych pozycji');
      return;
    }
    completeMutation.mutate();
  };

  if (isLoading) {
    return (
      <Layout title="Ładowanie...">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!inventory) {
    return (
      <Layout title="Błąd">
        <div className="glass-card p-8 text-center">
          <p className="text-slate-400">Inwentaryzacja nie znaleziona</p>
        </div>
      </Layout>
    );
  }

  if (inventory.status !== 'IN_PROGRESS') {
    return (
      <Layout title={inventory.name}>
        <div className="glass-card p-8 text-center">
          <Check className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <p className="text-white text-lg mb-2">Inwentaryzacja zakończona</p>
          <p className="text-slate-400">Zliczono {inventory.lines?.length || 0} pozycji</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={inventory.name}
      actions={
        <div className="flex gap-2">
          {/* Cancel button - ADMIN only */}
          {isAdmin && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => cancelMutation.mutate()}
              loading={cancelMutation.isPending}
            >
              Anuluj
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleFinishInventory}
            loading={completeMutation.isPending}
          >
            Zakończ wszystko
          </Button>
        </div>
      }
    >
      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
          step === 'scan-location' ? 'bg-primary-500/20 text-primary-400 scale-110' : 'bg-white/5 text-slate-500'
        )}>
          <MapPin className="w-4 h-4" />
          Lokalizacja
        </div>
        <div className="w-8 h-0.5 bg-white/10" />
        <div className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
          step === 'scan-products' ? 'bg-green-500/20 text-green-400 scale-110' : 'bg-white/5 text-slate-500'
        )}>
          <Package className="w-4 h-4" />
          Produkty
        </div>
        <div className="w-8 h-0.5 bg-white/10" />
        <div className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
          'bg-white/5 text-slate-500'
        )}>
          <Check className="w-4 h-4" />
          Zakończ
        </div>
      </div>

      {/* Scan input */}
      <form onSubmit={handleSubmit} className="mb-6 relative z-20">
        <div className={clsx(
          'glass-card p-6 transition-all',
          step === 'scan-location' && 'ring-2 ring-primary-500/50',
          step === 'scan-products' && 'ring-2 ring-green-500/50'
        )}>
          <div className="flex items-center gap-3 mb-4">
            {step === 'scan-location' ? (
              <>
                <div className="p-3 rounded-xl bg-primary-500/20">
                  <MapPin className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <div className="font-bold text-white text-lg">Skanuj lokalizację</div>
                  <div className="text-sm text-slate-400">Zeskanuj kod półki</div>
                </div>
              </>
            ) : (
              <>
                <div className="p-3 rounded-xl bg-green-500/20">
                  {currentContainer ? <Box className="w-6 h-6 text-green-400" /> : <Package className="w-6 h-6 text-green-400" />}
                </div>
                <div>
                  <div className="font-bold text-white text-lg">Skanuj produkty</div>
                  <div className="text-sm text-slate-400">
                    {currentContainer ? (
                      <>
                        Kuweta: <span className="text-primary-400 font-mono">{currentContainer.barcode}</span>
                        <span className="text-slate-500 mx-1">@</span>
                        <span className="text-green-400 font-mono">{currentLocation?.barcode}</span>
                      </>
                    ) : (
                      <>
                        Lokalizacja: <span className="text-green-400 font-mono">{currentLocation?.barcode}</span>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => step === 'scan-products' && inputValue.length >= 2 && setShowSearchDropdown(true)}
              onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
              disabled={isProcessing}
              placeholder={step === 'scan-location' ? 'Kod lokalizacji (np. PL1-01-01-01)' : 'Skanuj KUWETĘ (K...) lub EAN produktu...'}
              className="w-full px-4 py-4 rounded-xl bg-white/5 border-2 border-white/10 text-white text-lg font-mono text-center focus:border-primary-500 focus:outline-none transition-colors disabled:opacity-50"
              autoComplete="off"
              autoCapitalize="characters"
            />
            {isProcessing && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
              </div>
            )}

            {/* Product search autocomplete dropdown */}
            {showSearchDropdown && searchResults && searchResults.length > 0 && (
              <div className="absolute z-[100] w-full mt-2 rounded-xl bg-slate-800 border border-white/20 shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                <div className="px-3 py-2 bg-slate-700/50 text-xs text-slate-400 flex items-center gap-2">
                  <Search className="w-3 h-3" />
                  Znalezione produkty ({searchResults.length})
                </div>
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectProduct(product);
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-primary-500/20 transition-colors border-b border-white/5 last:border-b-0"
                  >
                    <div className="font-mono font-medium text-white">{product.sku}</div>
                    <div className="text-sm text-slate-400 truncate">{product.name}</div>
                    {product.ean && (
                      <div className="text-xs text-slate-500">EAN: {product.ean}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Current location products */}
      {step === 'scan-products' && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400">
              Zeskanowane produkty ({scannedProducts.length})
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFinishLocation}
              icon={<Check className="w-4 h-4" />}
            >
              Zakończ lokalizację
            </Button>
          </div>

          {/* PENDING PRODUCT - waiting for quantity input */}
          {pendingProduct && (
            <div className="glass-card p-4 mb-4 ring-2 ring-yellow-500/50 animate-fade-in">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-yellow-500/20">
                  <Package className="w-6 h-6 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <div className="font-mono font-bold text-white text-lg">{pendingProduct.sku}</div>
                  <div className="text-sm text-slate-400">{pendingProduct.name}</div>
                  <div className="text-xs text-slate-500">EAN: {pendingProduct.code}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm">Ilość:</span>
                <div className="flex items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      playClickBeep();
                      handleQtyChange(pendingQty - 1);
                    }}
                    className="p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    value={pendingQty}
                    onChange={(e) => handleQtyChange(parseInt(e.target.value) || 1)}
                    onKeyDown={handleQtyKeyDown}
                    className="flex-1 px-4 py-3 rounded-lg bg-white/10 border-2 border-yellow-500/50 text-white text-center text-2xl font-bold focus:outline-none focus:border-yellow-500"
                    min={1}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      playClickBeep();
                      handleQtyChange(pendingQty + 1);
                    }}
                    className="p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <Button
                  onClick={savePendingProduct}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black"
                >
                  OK
                </Button>
              </div>

              <div className="mt-2 text-xs text-yellow-400/70 text-center">
                Wpisz ilość i naciśnij Enter, lub skanuj następny produkt
              </div>
            </div>
          )}

          {scannedProducts.length === 0 && !pendingProduct ? (
            <div className="glass-card p-6 text-center">
              <Package className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400">Zeskanuj pierwszy produkt</p>
            </div>
          ) : scannedProducts.length > 0 ? (
            <div className="space-y-2">
              {scannedProducts.map((product, index) => (
                <div
                  key={`${product.code}-${index}`}
                  className="glass-card p-3 flex items-center gap-3 animate-fade-in cursor-pointer hover:bg-white/10 transition-colors"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => {
                    if (product.lineId) {
                      setEditingProduct(product);
                      setEditQty(product.qty);
                    }
                  }}
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-400 font-bold">{product.qty}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-medium text-white">{product.sku}</div>
                    {product.name && (
                      <div className="text-sm text-slate-400 truncate">{product.name}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      {product.priceBrutto !== null && (
                        <span className="text-emerald-400">{Number(product.priceBrutto).toFixed(2)} zł</span>
                      )}
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {product.scannedBy}
                      </span>
                      <span>{format(product.scannedAt, 'HH:mm', { locale: pl })}</span>
                    </div>
                  </div>
                  {/* Edit/Delete buttons - visible for all users */}
                  {product.lineId && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProduct(product);
                          setEditQty(product.qty);
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-primary-400 hover:bg-primary-500/10 transition-colors"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Czy na pewno usunąć tę pozycję?')) {
                            deleteLineMutation.mutate(product.lineId!);
                            // Also remove from local state
                            setScannedProducts(prev => prev.filter(p => p.lineId !== product.lineId));
                          }
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
          ) : null}
        </div>
      )}

      {/* Completed locations */}
      {completedLocations.length > 0 && (
        <div className="mb-6">
          <div className="text-sm text-slate-400 mb-3">
            Zakończone lokalizacje ({completedLocations.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {completedLocations.map((loc) => (
              <div
                key={loc}
                className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm font-mono flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {loc}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="glass-card p-4 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center mb-4">
          <div>
            <div className="text-2xl font-bold text-white">{completedLocations.length}</div>
            <div className="text-xs text-slate-400">Lokalizacji</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {(inventory.lines?.length || 0) + scannedProducts.length}
            </div>
            <div className="text-xs text-slate-400">Pozycji</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">
              {(inventory.lines?.reduce((sum, l) => sum + l.countedQty, 0) || 0) +
                scannedProducts.reduce((sum, p) => sum + p.qty, 0)}
            </div>
            <div className="text-xs text-slate-400">Sztuk</div>
          </div>
        </div>

        {/* Price summary */}
        <div className="border-t border-white/10 pt-4 grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">
              {(
                (inventory.lines?.reduce((sum, l) => {
                  const price = l.product.priceNetto ? Number(l.product.priceNetto) : 0;
                  return sum + (price * l.countedQty);
                }, 0) || 0) +
                scannedProducts.reduce((sum, p) => {
                  const price = p.priceNetto || 0;
                  return sum + (price * p.qty);
                }, 0)
              ).toFixed(2)} zł
            </div>
            <div className="text-xs text-slate-400">Wartość zakupu (netto)</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-400">
              {(
                (inventory.lines?.reduce((sum, l) => {
                  const price = l.product.priceBrutto ? Number(l.product.priceBrutto) : 0;
                  return sum + (price * l.countedQty);
                }, 0) || 0) +
                scannedProducts.reduce((sum, p) => {
                  const price = p.priceBrutto || 0;
                  return sum + (price * p.qty);
                }, 0)
              ).toFixed(2)} zł
            </div>
            <div className="text-xs text-slate-400">Wartość sprzedaży (brutto)</div>
          </div>
        </div>
      </div>

      {/* Admin Panel - TABLE VIEW like Excel */}
      {isAdmin && inventory.lines && inventory.lines.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="w-full glass-card p-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary-400" />
              <span className="font-medium text-white">Panel ADMIN</span>
              <span className="text-sm text-slate-400">({inventory.lines.length} pozycji w bazie)</span>
            </div>
            {showAdminPanel ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showAdminPanel && (
            <div className="mt-3">
              {/* Table container with horizontal scroll */}
              <div className="glass-card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left">
                      <th className="px-2 py-3 text-slate-400 font-medium">Lp</th>
                      <th className="px-2 py-3 text-slate-400 font-medium">SKU</th>
                      <th className="px-2 py-3 text-slate-400 font-medium min-w-[150px]">Nazwa</th>
                      <th className="px-2 py-3 text-slate-400 font-medium text-center">Ilość</th>
                      <th className="px-2 py-3 text-slate-400 font-medium text-right">Netto</th>
                      <th className="px-2 py-3 text-slate-400 font-medium text-right">Brutto</th>
                      <th className="px-2 py-3 text-slate-400 font-medium text-right">Wart. netto</th>
                      <th className="px-2 py-3 text-slate-400 font-medium text-right">Wart. brutto</th>
                      <th className="px-2 py-3 text-slate-400 font-medium">Kto</th>
                      {isInProgress && <th className="px-2 py-3 text-slate-400 font-medium text-center">Akcje</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.lines.map((line, index) => {
                      const priceNetto = line.product.priceNetto ? Number(line.product.priceNetto) : 0;
                      const priceBrutto = line.product.priceBrutto ? Number(line.product.priceBrutto) : 0;
                      const valueNetto = priceNetto * line.countedQty;
                      const valueBrutto = priceBrutto * line.countedQty;

                      return (
                        <tr
                          key={line.id}
                          className={clsx(
                            'border-b border-white/5 hover:bg-white/5 transition-colors',
                            isInProgress && 'cursor-pointer'
                          )}
                          onClick={() => {
                            if (isInProgress) {
                              setEditingProduct({
                                code: line.product.ean || line.product.sku,
                                sku: line.product.sku,
                                name: line.product.name,
                                qty: line.countedQty,
                                priceBrutto: line.product.priceBrutto ? Number(line.product.priceBrutto) : null,
                                priceNetto: line.product.priceNetto ? Number(line.product.priceNetto) : null,
                                scannedBy: line.countedBy?.name || '?',
                                scannedAt: line.countedAt ? new Date(line.countedAt) : new Date(),
                                lineId: line.id,
                                productId: line.product.id,
                              });
                              setEditQty(line.countedQty);
                              setEditPriceNetto(line.product.priceNetto ? String(Number(line.product.priceNetto)) : '');
                              setEditPriceBrutto(line.product.priceBrutto ? String(Number(line.product.priceBrutto)) : '');
                            }
                          }}
                        >
                          <td className="px-2 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-2 py-2 text-white font-mono text-xs">{line.product.sku}</td>
                          <td className="px-2 py-2 text-slate-300 truncate max-w-[200px]" title={line.product.name}>
                            {line.product.name}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className="bg-primary-500/20 text-primary-400 font-bold px-2 py-1 rounded">
                              {line.countedQty}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-right text-blue-400">
                            {priceNetto > 0 ? `${priceNetto.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-right text-emerald-400">
                            {priceBrutto > 0 ? `${priceBrutto.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-right text-blue-300">
                            {valueNetto > 0 ? `${valueNetto.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-right text-emerald-300">
                            {valueBrutto > 0 ? `${valueBrutto.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-slate-500 text-xs">
                            {line.countedBy?.name || '?'}
                          </td>
                          {isInProgress && (
                            <td className="px-2 py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProduct({
                                      code: line.product.ean || line.product.sku,
                                      sku: line.product.sku,
                                      name: line.product.name,
                                      qty: line.countedQty,
                                      priceBrutto: line.product.priceBrutto ? Number(line.product.priceBrutto) : null,
                                      priceNetto: line.product.priceNetto ? Number(line.product.priceNetto) : null,
                                      scannedBy: line.countedBy?.name || '?',
                                      scannedAt: line.countedAt ? new Date(line.countedAt) : new Date(),
                                      lineId: line.id,
                                      productId: line.product.id,
                                    });
                                    setEditQty(line.countedQty);
                                    setEditPriceNetto(line.product.priceNetto ? String(Number(line.product.priceNetto)) : '');
                                    setEditPriceBrutto(line.product.priceBrutto ? String(Number(line.product.priceBrutto)) : '');
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-primary-400 hover:bg-primary-500/10"
                                  title="Edytuj"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Czy na pewno usunąć tę pozycję?')) {
                                      deleteLineMutation.mutate(line.id);
                                    }
                                  }}
                                  disabled={deleteLineMutation.isPending}
                                  className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                  title="Usuń"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Summary footer */}
                  <tfoot>
                    <tr className="border-t-2 border-white/20 bg-white/5 font-bold">
                      <td className="px-2 py-3 text-slate-400" colSpan={3}>SUMA:</td>
                      <td className="px-2 py-3 text-center text-white">
                        {inventory.lines.reduce((sum, l) => sum + l.countedQty, 0)}
                      </td>
                      <td className="px-2 py-3"></td>
                      <td className="px-2 py-3"></td>
                      <td className="px-2 py-3 text-right text-blue-400">
                        {inventory.lines.reduce((sum, l) => {
                          const price = l.product.priceNetto ? Number(l.product.priceNetto) : 0;
                          return sum + (price * l.countedQty);
                        }, 0).toFixed(2)} zł
                      </td>
                      <td className="px-2 py-3 text-right text-emerald-400">
                        {inventory.lines.reduce((sum, l) => {
                          const price = l.product.priceBrutto ? Number(l.product.priceBrutto) : 0;
                          return sum + (price * l.countedQty);
                        }, 0).toFixed(2)} zł
                      </td>
                      <td className="px-2 py-3" colSpan={isInProgress ? 2 : 1}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal - with price editing */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Edycja pozycji</h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Product info */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="font-mono font-medium text-white">{editingProduct.sku}</div>
                <div className="text-sm text-slate-400">{editingProduct.name}</div>
              </div>

              {/* Quantity */}
              <div>
                <div className="text-sm text-slate-400 mb-2">Ilość</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      playClickBeep();
                      setEditQty(Math.max(0, editQty - 1));
                    }}
                    className="p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    value={editQty}
                    onChange={(e) => setEditQty(parseInt(e.target.value) || 0)}
                    className="flex-1 px-4 py-3 rounded-lg bg-white/10 border-2 border-primary-500/50 text-white text-center text-2xl font-bold focus:outline-none focus:border-primary-500"
                    min={0}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      playClickBeep();
                      setEditQty(editQty + 1);
                    }}
                    className="p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Price fields - only for ADMIN */}
              {isAdmin && (
                <div className="border-t border-white/10 pt-4">
                  <div className="text-sm text-slate-400 mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Edycja cen (ADMIN)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-blue-400 mb-1">Cena netto (zakup)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editPriceNetto}
                        onChange={(e) => setEditPriceNetto(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-blue-500/30 text-white text-right focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-emerald-400 mb-1">Cena brutto (sprzedaż)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editPriceBrutto}
                        onChange={(e) => setEditPriceBrutto(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-lg bg-white/10 border border-emerald-500/30 text-white text-right focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setEditingProduct(null)}
                  className="flex-1"
                >
                  Anuluj
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingProduct.lineId) return;
                    try {
                      // Update line quantity
                      await updateLineMutation.mutateAsync({
                        lineId: editingProduct.lineId,
                        countedQty: editQty,
                      });

                      // Update product prices if ADMIN and productId exists
                      if (isAdmin && editingProduct.productId) {
                        const newPriceNetto = editPriceNetto ? parseFloat(editPriceNetto) : null;
                        const newPriceBrutto = editPriceBrutto ? parseFloat(editPriceBrutto) : null;

                        // Only update if prices changed
                        if (newPriceNetto !== editingProduct.priceNetto || newPriceBrutto !== editingProduct.priceBrutto) {
                          await updateProductPriceMutation.mutateAsync({
                            productId: editingProduct.productId,
                            priceNetto: newPriceNetto,
                            priceBrutto: newPriceBrutto,
                          });
                        }
                      }

                      // Update local scannedProducts state
                      setScannedProducts(prev => prev.map(p =>
                        p.lineId === editingProduct.lineId
                          ? { ...p, qty: editQty }
                          : p
                      ));
                      setEditingProduct(null);
                    } catch {
                      // Error handled in mutation
                    }
                  }}
                  disabled={updateLineMutation.isPending || updateProductPriceMutation.isPending}
                  className="flex-1"
                >
                  {(updateLineMutation.isPending || updateProductPriceMutation.isPending) ? 'Zapisywanie...' : 'Zapisz'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

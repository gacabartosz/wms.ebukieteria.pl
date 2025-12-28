import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Package, Check, Box, Minus, Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { inventoryService } from '../services/inventoryService';
import { containersService } from '../services/containersService';
import { productsService } from '../services/productsService';
import { playBeep, playLocationBeep } from '../utils/sounds';
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
}

interface PendingProduct {
  code: string;
  sku: string;
  name: string;
  productId: string;
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

  // Handle selecting product from autocomplete dropdown
  const handleSelectProduct = useCallback(async (product: { id: string; sku: string; ean: string | null; name: string }) => {
    setShowSearchDropdown(false);
    setInputValue('');

    // Process as if scanned by EAN or SKU
    const code = product.ean || product.sku;
    await handleProductScan(code);
  }, []);

  // Save pending product to backend
  const savePendingProduct = useCallback(async () => {
    if (!pendingProduct || !currentLocation) return;

    try {
      await addLineMutation.mutateAsync({
        locationBarcode: currentLocation.barcode,
        productCode: pendingProduct.code,
        countedQty: pendingQty,
      });

      // Add to scanned list
      setScannedProducts(prev => [
        ...prev,
        {
          code: pendingProduct.code,
          sku: pendingProduct.sku,
          name: pendingProduct.name,
          qty: pendingQty,
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
  }, [pendingProduct, currentLocation, pendingQty]);

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

      // Set as new pending product
      setPendingProduct({
        code: code,
        sku: productInfo.sku,
        name: productInfo.name,
        productId: productInfo.id,
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
      <form onSubmit={handleSubmit} className="mb-6">
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
              placeholder={step === 'scan-location' ? 'Kod lokalizacji (np. PL1-01-01-01)' : 'Skanuj EAN lub wpisz nazwe produktu...'}
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
              <div className="absolute z-50 w-full mt-2 rounded-xl bg-slate-800 border border-white/20 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
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
                    onClick={() => handleQtyChange(pendingQty - 1)}
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
                    onClick={() => handleQtyChange(pendingQty + 1)}
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
                  className="glass-card p-3 flex items-center gap-3 animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-400 font-bold">{product.qty}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-medium text-white">{product.sku}</div>
                    {product.name && (
                      <div className="text-sm text-slate-400 truncate">{product.name}</div>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">{product.code}</div>
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
      <div className="glass-card p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
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
      </div>
    </Layout>
  );
}

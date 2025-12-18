import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Package, Check, Box } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { inventoryService } from '../services/inventoryService';
import { containersService } from '../services/containersService';
import { playBeep, playLocationBeep } from '../utils/sounds';
import clsx from 'clsx';

type Step = 'scan-location' | 'scan-products' | 'completed';

interface ScannedProduct {
  code: string;
  sku: string;
  name: string;
  qty: number;
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

  // Helper to clear input and reset scanner detection
  const clearInput = useCallback(() => {
    clearInput();
    inputLengthBeforeRef.current = 0;
    lastInputTimeRef.current = 0;
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

  // Handle product scan
  const handleProductScan = async (code: string) => {
    if (!currentLocation) return;

    // Check if this is a container barcode (starts with K followed by digits)
    if (/^K\d+$/i.test(code)) {
      await handleContainerScan(code);
      return;
    }

    // Check if product already scanned
    const existingIndex = scannedProducts.findIndex(
      (p) => p.code.toLowerCase() === code.toLowerCase()
    );

    if (existingIndex >= 0) {
      // Increment quantity
      const updated = [...scannedProducts];
      updated[existingIndex].qty += 1;
      setScannedProducts(updated);

      // Save to backend
      await addLineMutation.mutateAsync({
        locationBarcode: currentLocation.barcode,
        productCode: code,
        countedQty: updated[existingIndex].qty,
      });

      playBeep('success');
      clearInput();
    } else {
      // New product - save with qty 1
      try {
        const result = await addLineMutation.mutateAsync({
          locationBarcode: currentLocation.barcode,
          productCode: code,
          countedQty: 1,
        });

        setScannedProducts([
          ...scannedProducts,
          {
            code,
            sku: result.product?.sku || code,
            name: result.product?.name || '',
            qty: 1,
          },
        ]);

        playBeep('success');
        clearInput();
      } catch {
        // Error handled in mutation
        clearInput();
      }
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
      autoSubmitTimerRef.current = setTimeout(() => {
        processCode(value.trim());
      }, 100);
    }
    // Manual typing - no auto-submit, user must press Enter
  }, [processCode]);

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
  const handleFinishLocation = () => {
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
    setStep('scan-location');
    clearInput();
  };

  // Finish entire inventory
  const handleFinishInventory = () => {
    if (completedLocations.length === 0 && scannedProducts.length === 0) {
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
              disabled={isProcessing}
              placeholder={step === 'scan-location' ? 'Kod lokalizacji (np. PL1-01-01-01)' : 'Kod EAN produktu lub kuwety (K...)'}
              className="w-full px-4 py-4 rounded-xl bg-white/5 border-2 border-white/10 text-white text-lg font-mono text-center focus:border-primary-500 focus:outline-none transition-colors disabled:opacity-50"
              autoComplete="off"
              autoCapitalize="characters"
            />
            {isProcessing && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
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

          {scannedProducts.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <Package className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400">Zeskanuj pierwszy produkt</p>
            </div>
          ) : (
            <div className="space-y-2">
              {scannedProducts.map((product, index) => (
                <div
                  key={product.code}
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
          )}
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

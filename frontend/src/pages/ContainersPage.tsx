import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Box, Plus, Filter, MapPin, Package, ArrowRight, X, ChevronUp, ChevronDown, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { containersService } from '../services/containersService';

type SortField = 'barcode' | 'location' | 'stockCount';
type SortDir = 'asc' | 'desc';

export default function ContainersPage() {
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState<string | null>(null);
  const [showContentsModal, setShowContentsModal] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: '', unassigned: false });
  const [newContainer, setNewContainer] = useState({ barcode: '', name: '', locationBarcode: '' });
  const [bulkCount, setBulkCount] = useState(10);
  const [moveLocation, setMoveLocation] = useState('');
  const [sortField, setSortField] = useState<SortField>('barcode');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { data, isLoading } = useQuery({
    queryKey: ['containers', filters],
    queryFn: () => containersService.getContainers({
      search: filters.search || undefined,
      unassigned: filters.unassigned || undefined,
      limit: 500,
    }),
  });

  const { data: contentsData, isLoading: contentsLoading } = useQuery({
    queryKey: ['container-contents', showContentsModal],
    queryFn: () => containersService.getContainerContents(showContentsModal!),
    enabled: !!showContentsModal,
  });

  const createMutation = useMutation({
    mutationFn: containersService.createContainer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setShowForm(false);
      setNewContainer({ barcode: '', name: '', locationBarcode: '' });
      toast.success('Kuweta utworzona');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd tworzenia');
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: containersService.bulkCreateContainers,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setShowForm(false);
      toast.success(`Utworzono ${result.length} kuwet`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd tworzenia');
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, locationBarcode }: { id: string; locationBarcode: string }) =>
      containersService.moveContainer(id, locationBarcode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      setShowMoveModal(null);
      setMoveLocation('');
      toast.success('Kuweta przeniesiona');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd przenoszenia');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      barcode: newContainer.barcode || undefined,
      name: newContainer.name || undefined,
      locationBarcode: newContainer.locationBarcode || undefined,
    });
  };

  const handleBulkCreate = () => {
    if (bulkCount < 1 || bulkCount > 100) {
      toast.error('Ilość musi być między 1 a 100');
      return;
    }
    bulkCreateMutation.mutate(bulkCount);
  };

  const handleMove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showMoveModal || !moveLocation) return;
    moveMutation.mutate({ id: showMoveModal, locationBarcode: moveLocation });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExport = async () => {
    try {
      await containersService.exportToExcel();
      toast.success('Eksport zakończony');
    } catch {
      toast.error('Błąd eksportu');
    }
  };

  // Sort containers
  const sortedContainers = [...(data?.data || [])].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortField) {
      case 'location':
        aVal = a.location?.barcode || '';
        bVal = b.location?.barcode || '';
        break;
      case 'stockCount':
        aVal = a.stockCount;
        bVal = b.stockCount;
        break;
      default:
        aVal = a.barcode;
        bVal = b.barcode;
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  const selectedContainer = data?.data.find(c => c.id === showMoveModal);

  return (
    <Layout
      title="Kuwety"
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExport}
            icon={<Download className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            size="sm"
            variant={showFilters ? 'secondary' : 'ghost'}
            onClick={() => setShowFilters(!showFilters)}
            icon={<Filter className="w-4 h-4" />}
          />
          <Button size="sm" onClick={() => setShowForm(!showForm)} icon={<Plus className="w-4 h-4" />}>
            Dodaj
          </Button>
        </div>
      }
    >
      {/* Create form */}
      {showForm && (
        <div className="glass-card p-4 mb-4 space-y-4 animate-fade-in">
          <h3 className="font-medium text-white">Nowa kuweta</h3>

          {/* Single create */}
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              label="Kod kuwety (opcjonalnie)"
              value={newContainer.barcode}
              onChange={(e) => setNewContainer({ ...newContainer, barcode: e.target.value.toUpperCase() })}
              placeholder="np. K000001 (auto jeśli puste)"
            />
            <Input
              label="Nazwa (opcjonalnie)"
              value={newContainer.name}
              onChange={(e) => setNewContainer({ ...newContainer, name: e.target.value })}
              placeholder="np. Kuweta Nike"
            />
            <Input
              label="Lokalizacja (opcjonalnie)"
              value={newContainer.locationBarcode}
              onChange={(e) => setNewContainer({ ...newContainer, locationBarcode: e.target.value.toUpperCase() })}
              placeholder="np. PL1-01-01-01"
            />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
                Anuluj
              </Button>
              <Button type="submit" loading={createMutation.isPending} className="flex-1">
                Utwórz
              </Button>
            </div>
          </form>

          {/* Bulk create */}
          <div className="border-t border-white/10 pt-4">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Lub utwórz wiele</h4>
            <div className="flex gap-2">
              <Input
                type="number"
                value={bulkCount}
                onChange={(e) => setBulkCount(parseInt(e.target.value) || 10)}
                min={1}
                max={100}
                className="w-24"
              />
              <Button
                onClick={handleBulkCreate}
                loading={bulkCreateMutation.isPending}
                variant="secondary"
                className="flex-1"
              >
                Utwórz {bulkCount} kuwet
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-4 mb-4 animate-fade-in">
          <div className="flex gap-3">
            <Input
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Szukaj po kodzie..."
              className="flex-1"
            />
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={filters.unassigned}
                onChange={(e) => setFilters({ ...filters, unassigned: e.target.checked })}
                className="rounded border-white/20 bg-white/5"
              />
              Bez lokalizacji
            </label>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card p-3 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : sortedContainers.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Box className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Brak kuwet</p>
        </div>
      ) : (
        <>
          {/* Desktop table view */}
          <div className="hidden md:block glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th
                    className="px-4 py-3 text-left cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('barcode')}
                  >
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-400 uppercase">
                      Kod kuwety <SortIcon field="barcode" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <div className="text-xs font-medium text-slate-400 uppercase">Nazwa</div>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('location')}
                  >
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-400 uppercase">
                      Lokalizacja <SortIcon field="location" />
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-center cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('stockCount')}
                  >
                    <div className="flex items-center justify-center gap-1 text-xs font-medium text-slate-400 uppercase">
                      Produkty <SortIcon field="stockCount" />
                    </div>
                  </th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {sortedContainers.map((container) => (
                  <tr key={container.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span className="font-mono font-medium text-primary-400">{container.barcode}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300">{container.name || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {container.location ? (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-green-400" />
                          <span className="font-mono text-white">{container.location.barcode}</span>
                          {container.location.zone && (
                            <span className="text-xs text-slate-500">({container.location.zone})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">Nie przypisana</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setShowContentsModal(container.id)}
                        className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                      >
                        <Package className="w-4 h-4" />
                        <span>{container.stockCount}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowMoveModal(container.id)}
                        icon={<ArrowRight className="w-4 h-4" />}
                      >
                        Przenieś
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile grid view */}
          <div className="md:hidden space-y-2">
            {sortedContainers.map((container) => (
              <div key={container.id} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-medium text-primary-400 text-lg">{container.barcode}</span>
                  <button
                    onClick={() => setShowContentsModal(container.id)}
                    className="flex items-center gap-1 text-slate-300"
                  >
                    <Package className="w-4 h-4" />
                    <span className="text-sm">{container.stockCount}</span>
                  </button>
                </div>
                {container.name && (
                  <div className="text-sm text-slate-400 mb-2">{container.name}</div>
                )}
                <div className="flex items-center justify-between">
                  {container.location ? (
                    <div className="flex items-center gap-1 text-sm">
                      <MapPin className="w-3 h-3 text-green-400" />
                      <span className="font-mono text-white">{container.location.barcode}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">Nie przypisana</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowMoveModal(container.id)}
                  >
                    Przenieś
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data?.pagination && (
        <div className="text-center text-sm text-slate-400 mt-4">
          Pokazano {sortedContainers.length} z {data.pagination.total}
        </div>
      )}

      {/* Move Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="glass-card p-6 max-w-md w-full animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">
                Przenieś kuwetę {selectedContainer?.barcode}
              </h3>
              <button onClick={() => setShowMoveModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleMove} className="space-y-4">
              <Input
                label="Kod lokalizacji docelowej"
                value={moveLocation}
                onChange={(e) => setMoveLocation(e.target.value.toUpperCase())}
                placeholder="np. PL1-01-01-01"
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowMoveModal(null)} className="flex-1">
                  Anuluj
                </Button>
                <Button type="submit" loading={moveMutation.isPending} className="flex-1">
                  Przenieś
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contents Modal */}
      {showContentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="glass-card p-6 max-w-lg w-full max-h-[80vh] overflow-auto animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">
                Zawartość kuwety {contentsData?.barcode}
              </h3>
              <button onClick={() => setShowContentsModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {contentsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse h-12 bg-white/5 rounded-lg" />
                ))}
              </div>
            ) : contentsData?.items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                <p className="text-slate-400">Kuweta jest pusta</p>
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {contentsData?.items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center">
                          <Package className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-mono font-medium text-white">{item.sku}</div>
                        <div className="text-sm text-slate-400 truncate">{item.name}</div>
                      </div>
                      <div className="text-lg font-bold text-primary-400">{item.qty}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-4 flex justify-between text-sm">
                  <span className="text-slate-400">Unikalnych produktów: {contentsData?.uniqueProducts}</span>
                  <span className="text-white font-medium">Razem: {contentsData?.totalQty} szt.</span>
                </div>
              </>
            )}

            <Button
              variant="secondary"
              onClick={() => setShowContentsModal(null)}
              className="w-full mt-4"
            >
              Zamknij
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}

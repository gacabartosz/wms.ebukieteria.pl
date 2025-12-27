import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Filter, Lock, Unlock, AlertTriangle, Upload, ChevronUp, ChevronDown, Download, Trash2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import ImportModal, { ImportField } from '../components/ImportModal';
import { locationsService } from '../services/locationsService';
import { warehousesService } from '../services/warehousesService';
import type { Location } from '../types';
import clsx from 'clsx';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIVE: { label: 'Aktywna', color: 'text-green-400', icon: <Unlock className="w-4 h-4" /> },
  BLOCKED: { label: 'Zablokowana', color: 'text-red-400', icon: <Lock className="w-4 h-4" /> },
  COUNTING: { label: 'Inwentaryzacja', color: 'text-yellow-400', icon: <AlertTriangle className="w-4 h-4" /> },
};

const importFields: ImportField[] = [
  { key: 'barcode', label: 'Kod lokalizacji', required: true, example: 'PL1-01-01-01' },
  { key: 'warehouseCode', label: 'Kod magazynu', required: true, example: 'PL1' },
  { key: 'zone', label: 'Strefa', required: false, example: 'A' },
];

type SortField = 'barcode' | 'zone';
type SortDir = 'asc' | 'desc';

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filters, setFilters] = useState({ warehouseId: '', zone: '', status: '' });
  const [newLocation, setNewLocation] = useState({ barcode: '', warehouseId: '', zone: '' });
  const [sortField, setSortField] = useState<SortField>('barcode');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editData, setEditData] = useState({ zone: '' });

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getWarehouses({ limit: 100 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['locations', filters],
    queryFn: () => locationsService.getLocations({
      ...filters,
      warehouseId: filters.warehouseId || undefined,
      zone: filters.zone || undefined,
      status: filters.status || undefined,
      limit: 500,
    }),
  });

  const createMutation = useMutation({
    mutationFn: locationsService.createLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setShowForm(false);
      setNewLocation({ barcode: '', warehouseId: '', zone: '' });
      toast.success('Lokalizacja utworzona');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd tworzenia');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      locationsService.updateLocation(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Status zmieniony');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { zone?: string } }) =>
      locationsService.updateLocation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      setEditingLocation(null);
      toast.success('Lokalizacja zaktualizowana');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd aktualizacji');
    },
  });

  const handleEdit = (loc: Location) => {
    setEditingLocation(loc);
    setEditData({ zone: loc.zone || '' });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data: { zone: editData.zone || undefined } });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: locationsService.deleteLocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Lokalizacja usunięta');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd usuwania');
    },
  });

  const handleDelete = (id: string, barcode: string) => {
    if (window.confirm(`Czy na pewno chcesz usunąć lokalizację ${barcode}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocation.barcode || !newLocation.warehouseId) {
      toast.error('Wypełnij wymagane pola');
      return;
    }
    createMutation.mutate(newLocation);
  };

  const handleImport = async (importData: Record<string, string>[]) => {
    let success = 0;
    const errors: string[] = [];

    // Get warehouse mapping
    const warehouseMap = new Map<string, string>();
    warehousesData?.data.forEach((wh) => {
      warehouseMap.set(wh.code.toLowerCase(), wh.id);
    });

    for (const row of importData) {
      try {
        const warehouseId = warehouseMap.get(row.warehouseCode?.toLowerCase() || '');
        if (!warehouseId) {
          errors.push(`${row.barcode}: Nieznany magazyn ${row.warehouseCode}`);
          continue;
        }

        await locationsService.createLocation({
          barcode: row.barcode,
          warehouseId,
          zone: row.zone || undefined,
        });
        success++;
      } catch (error: any) {
        errors.push(`${row.barcode}: ${error.response?.data?.error || 'Błąd'}`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['locations'] });
    return { success, errors };
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
      await locationsService.exportToExcel();
      toast.success('Eksport zakończony');
    } catch {
      toast.error('Błąd eksportu');
    }
  };

  // Sort locations
  const sortedLocations = [...(data?.data || [])].sort((a, b) => {
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
    const cmp = String(aVal).localeCompare(String(bVal));
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Get unique zones from data
  const zones = [...new Set(data?.data.map((loc) => loc.zone).filter(Boolean))].sort();

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <Layout
      title="Lokalizacje"
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
            variant="ghost"
            onClick={() => setShowImport(true)}
            icon={<Upload className="w-4 h-4" />}
          >
            <span className="hidden sm:inline">Import</span>
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
      {/* Edit Modal */}
      {editingLocation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveEdit} className="glass-card p-6 w-full max-w-md animate-fade-in">
            <h3 className="font-medium text-white text-lg mb-4">
              Edytuj lokalizację: <span className="text-primary-400">{editingLocation.barcode}</span>
            </h3>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-white/5">
                <div className="text-xs text-slate-500 mb-1">Magazyn</div>
                <div className="text-white font-medium">{editingLocation.warehouse?.code || '-'}</div>
              </div>
              <Input
                label="Strefa"
                value={editData.zone}
                onChange={(e) => setEditData({ ...editData, zone: e.target.value.toUpperCase() })}
                placeholder="np. A"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingLocation(null)}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button type="submit" loading={updateMutation.isPending} className="flex-1">
                Zapisz
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="glass-card p-4 mb-4 space-y-3 animate-fade-in">
          <h3 className="font-medium text-white">Nowa lokalizacja</h3>
          <Input
            label="Kod lokalizacji"
            value={newLocation.barcode}
            onChange={(e) => setNewLocation({ ...newLocation, barcode: e.target.value.toUpperCase() })}
            placeholder="np. PL1-01-01-01"
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Magazyn</label>
            <select
              value={newLocation.warehouseId}
              onChange={(e) => setNewLocation({ ...newLocation, warehouseId: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            >
              <option value="">Wybierz magazyn</option>
              {warehousesData?.data.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.code}</option>
              ))}
            </select>
          </div>
          <Input
            label="Strefa (opcjonalnie)"
            value={newLocation.zone}
            onChange={(e) => setNewLocation({ ...newLocation, zone: e.target.value.toUpperCase() })}
            placeholder="np. A"
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
      )}

      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-4 mb-4 animate-fade-in">
          <div className="grid grid-cols-3 gap-3">
            <select
              value={filters.warehouseId}
              onChange={(e) => setFilters({ ...filters, warehouseId: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="">Wszystkie magazyny</option>
              {warehousesData?.data.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.code}</option>
              ))}
            </select>
            <select
              value={filters.zone}
              onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="">Wszystkie strefy</option>
              {zones.map((z) => (
                <option key={z} value={z}>Strefa {z}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="">Wszystkie statusy</option>
              <option value="ACTIVE">Aktywne</option>
              <option value="BLOCKED">Zablokowane</option>
              <option value="COUNTING">Inwentaryzacja</option>
            </select>
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
      ) : sortedLocations.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <MapPin className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Brak lokalizacji</p>
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
                      Kod lokalizacji <SortIcon field="barcode" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <div className="text-xs font-medium text-slate-400 uppercase">Magazyn</div>
                  </th>
                  <th
                    className="px-4 py-3 text-left cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('zone')}
                  >
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-400 uppercase">
                      Strefa <SortIcon field="zone" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center">
                    <div className="text-xs font-medium text-slate-400 uppercase">Status</div>
                  </th>
                  <th className="px-4 py-3 w-24">
                    <div className="text-xs font-medium text-slate-400 uppercase">Akcje</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedLocations.map((loc) => {
                  const status = statusConfig[loc.status];
                  return (
                    <tr key={loc.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-white">{loc.barcode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-300">{loc.warehouse?.code || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-400">{loc.zone || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={clsx('flex items-center justify-center gap-1', status.color)}>
                          {status.icon}
                          <span className="text-xs">{status.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(loc)}
                            className="p-1.5 rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-white/10"
                            title="Edytuj lokalizację"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStatusMutation.mutate({
                              id: loc.id,
                              status: loc.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE',
                            })}
                            className={clsx('p-1.5 rounded-lg transition-colors', status.color, 'hover:bg-white/10')}
                            title={loc.status === 'ACTIVE' ? 'Zablokuj' : 'Odblokuj'}
                          >
                            {loc.status === 'ACTIVE' ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(loc.id, loc.barcode)}
                            className="p-1.5 rounded-lg transition-colors text-red-400 hover:bg-red-500/20"
                            title="Usuń lokalizację"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile grid view */}
          <div className="md:hidden grid grid-cols-2 sm:grid-cols-3 gap-2">
            {sortedLocations.map((loc) => {
              const status = statusConfig[loc.status];
              return (
                <div key={loc.id} className="glass-card p-3 flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono font-medium text-white text-sm">{loc.barcode}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(loc)}
                        className="p-1 rounded text-slate-400"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleStatusMutation.mutate({
                          id: loc.id,
                          status: loc.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE',
                        })}
                        className={clsx('p-1 rounded', status.color)}
                      >
                        {status.icon}
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id, loc.barcode)}
                        className="p-1 rounded text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {loc.warehouse?.code} • Strefa {loc.zone || '-'}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {data?.pagination && (
        <div className="text-center text-sm text-slate-400 mt-4">
          Pokazano {sortedLocations.length} z {data.pagination.total}
        </div>
      )}

      {/* Import modal */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        fields={importFields}
        title="Import lokalizacji"
        templateFileName="lokalizacje_szablon"
      />
    </Layout>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ClipboardList, Check, X, Clock, Download, Edit2, Trash2, Package, Camera, FileSpreadsheet, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { inventoryService } from '../services/inventoryService';
import { inventoryIntroService } from '../services/inventoryIntroService';
import { warehousesService } from '../services/warehousesService';
import { useAuthStore } from '../store/authStore';
import type { InventoryCount } from '../types';
import clsx from 'clsx';

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  IN_PROGRESS: { icon: <Clock className="w-4 h-4" />, label: 'W trakcie', color: 'text-yellow-400' },
  COMPLETED: { icon: <Check className="w-4 h-4" />, label: 'Zakończona', color: 'text-green-400' },
  CANCELLED: { icon: <X className="w-4 h-4" />, label: 'Anulowana', color: 'text-red-400' },
};

type InventoryType = 'standard' | 'intro' | null;

export default function InventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [showForm, setShowForm] = useState(false);
  const [inventoryType, setInventoryType] = useState<InventoryType>(null);
  const [filters, setFilters] = useState({ status: '' });
  const [newInventory, setNewInventory] = useState({ name: '', warehouseId: '' });
  const [newIntroInventory, setNewIntroInventory] = useState({ name: '' });
  const [editingInventory, setEditingInventory] = useState<InventoryCount | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<InventoryCount | null>(null);

  // Export state (only for ADMIN)
  const [selectedIntros, setSelectedIntros] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Delete intro inventory state (ADMIN only)
  const [deleteIntroConfirm, setDeleteIntroConfirm] = useState<{ id: string; name: string; linesCount: number; status: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteConfirmCheckbox, setDeleteConfirmCheckbox] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getWarehouses({ limit: 100 }),
  });

  // Get default warehouse for intro inventory
  const { data: defaultWarehouse } = useQuery({
    queryKey: ['inventory-intro-default-warehouse'],
    queryFn: () => inventoryIntroService.getDefaultWarehouse(),
    enabled: inventoryType === 'intro',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', filters],
    queryFn: () => inventoryService.getInventoryCounts({
      status: filters.status || undefined,
    }),
  });

  // Get intro inventories list
  const { data: introData } = useQuery({
    queryKey: ['inventory-intro-list'],
    queryFn: () => inventoryIntroService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: inventoryService.createInventoryCount,
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inwentaryzacja utworzona');
      navigate(`/inventory/${inv.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Blad tworzenia');
    },
  });

  // Create intro inventory mutation
  const createIntroMutation = useMutation({
    mutationFn: inventoryIntroService.create,
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intro-list'] });
      toast.success('Inwentaryzacja utworzona');
      setShowForm(false);
      setInventoryType(null);
      setNewIntroInventory({ name: '' });
      navigate(`/inventory-intro/${inv.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Blad tworzenia');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      inventoryService.updateInventoryCount(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Nazwa zmieniona');
      setEditingInventory(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd edycji');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: inventoryService.deleteInventoryCount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inwentaryzacja usunięta');
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd usuwania');
    },
  });

  // Delete intro inventory mutation (ADMIN only)
  const deleteIntroMutation = useMutation({
    mutationFn: inventoryIntroService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-intro-list'] });
      toast.success('Inwentaryzacja zostala usunieta');
      setDeleteIntroConfirm(null);
      setDeleteConfirmText('');
      setDeleteConfirmCheckbox(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Blad usuwania');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInventory.name || !newInventory.warehouseId) {
      toast.error('Wypelnij wszystkie pola');
      return;
    }
    createMutation.mutate(newInventory);
  };

  const handleCreateIntro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIntroInventory.name) {
      toast.error('Podaj nazwe inwentaryzacji');
      return;
    }
    if (!defaultWarehouse) {
      toast.error('Brak domyslnego magazynu');
      return;
    }
    createIntroMutation.mutate({
      name: newIntroInventory.name,
      warehouseId: defaultWarehouse.id,
      defaultLocationBarcode: 'TAR-KWIACIARNIA-01',
    });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setInventoryType(null);
    setNewInventory({ name: '', warehouseId: '' });
    setNewIntroInventory({ name: '' });
  };

  const handleExport = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    try {
      await inventoryService.exportToExcel(id, name);
      toast.success('Eksport zakończony');
    } catch {
      toast.error('Błąd eksportu');
    }
  };

  const handleEdit = (e: React.MouseEvent, inv: InventoryCount) => {
    e.stopPropagation();
    setEditingInventory(inv);
    setEditName(inv.name);
  };

  const handleDelete = (e: React.MouseEvent, inv: InventoryCount) => {
    e.stopPropagation();
    setDeleteConfirm(inv);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast.error('Nazwa nie może być pusta');
      return;
    }
    if (editingInventory) {
      updateMutation.mutate({ id: editingInventory.id, name: editName.trim() });
    }
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm.id);
    }
  };

  // Handle delete intro inventory
  const handleDeleteIntro = (e: React.MouseEvent, inv: { id: string; name: string; _count?: { lines: number }; status: string }) => {
    e.stopPropagation();
    setDeleteIntroConfirm({
      id: inv.id,
      name: inv.name,
      linesCount: inv._count?.lines || 0,
      status: inv.status,
    });
    setDeleteConfirmText('');
    setDeleteConfirmCheckbox(false);
  };

  const handleConfirmDeleteIntro = () => {
    if (deleteIntroConfirm && deleteConfirmCheckbox && deleteConfirmText.toLowerCase() === 'potwierdzam') {
      deleteIntroMutation.mutate(deleteIntroConfirm.id);
    }
  };

  // Toggle selection for export
  const toggleIntroSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIntros);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIntros(newSelected);
  };

  // Export handlers
  const handleExportExcel = async () => {
    if (selectedIntros.size === 0) {
      toast.error('Wybierz co najmniej jedną inwentaryzację');
      return;
    }
    setExporting(true);
    try {
      const blob = await inventoryIntroService.exportExcel(Array.from(selectedIntros));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inwentaryzacja_${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Eksport Excel zakończony');
      setShowExportModal(false);
      setSelectedIntros(new Set());
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Błąd eksportu');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (selectedIntros.size === 0) {
      toast.error('Wybierz co najmniej jedną inwentaryzację');
      return;
    }
    setExporting(true);
    try {
      const blob = await inventoryIntroService.exportCSV(Array.from(selectedIntros));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inwentaryzacja_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Eksport CSV zakończony');
      setShowExportModal(false);
      setSelectedIntros(new Set());
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Błąd eksportu');
    } finally {
      setExporting(false);
    }
  };

  // Get completed intro inventories
  const completedIntros = introData?.data.filter(inv => inv.status === 'COMPLETED') || [];

  return (
    <Layout
      title="Inwentaryzacja"
      actions={
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          icon={<Plus className="w-4 h-4" />}
        >
          Nowa
        </Button>
      }
    >
      {/* Create form */}
      {showForm && (
        <div className="glass-card p-4 mb-4 space-y-4 animate-fade-in">
          <h3 className="font-medium text-white">Nowa inwentaryzacja</h3>

          {/* Type selection */}
          {!inventoryType && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInventoryType('standard')}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-primary-500/50 transition-all text-left"
              >
                <Package className="w-8 h-8 text-blue-400 mb-2" />
                <div className="font-medium text-white">Standardowa</div>
                <div className="text-xs text-slate-400">Istniejace produkty</div>
              </button>
              <button
                type="button"
                onClick={() => setInventoryType('intro')}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-green-500/50 transition-all text-left"
              >
                <Camera className="w-8 h-8 text-green-400 mb-2" />
                <div className="font-medium text-white">Nowe produkty</div>
                <div className="text-xs text-slate-400">Ze zdjeciem i cena</div>
              </button>
            </div>
          )}

          {/* Standard inventory form */}
          {inventoryType === 'standard' && (
            <form onSubmit={handleCreate} className="space-y-3">
              <Input
                label="Nazwa"
                value={newInventory.name}
                onChange={(e) => setNewInventory({ ...newInventory, name: e.target.value })}
                placeholder="np. Inwentaryzacja Q4 2024"
              />
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Magazyn</label>
                <select
                  value={newInventory.warehouseId}
                  onChange={(e) => setNewInventory({ ...newInventory, warehouseId: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
                >
                  <option value="">Wybierz magazyn</option>
                  {warehousesData?.data.map((wh) => (
                    <option key={wh.id} value={wh.id}>{wh.code} - {wh.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={handleCloseForm} className="flex-1">
                  Anuluj
                </Button>
                <Button type="submit" loading={createMutation.isPending} className="flex-1">
                  Utworz
                </Button>
              </div>
            </form>
          )}

          {/* Intro inventory form - simplified */}
          {inventoryType === 'intro' && (
            <form onSubmit={handleCreateIntro} className="space-y-3">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <Camera className="w-4 h-4" />
                  <span className="font-medium">TAR-KWIACIARNIA</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Domyslny magazyn i lokalizacja
                </div>
              </div>
              <Input
                label="Nazwa inwentaryzacji"
                value={newIntroInventory.name}
                onChange={(e) => setNewIntroInventory({ name: e.target.value })}
                placeholder="np. Przyjecie towaru 27.12"
                autoFocus
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={handleCloseForm} className="flex-1">
                  Anuluj
                </Button>
                <Button type="submit" loading={createIntroMutation.isPending} className="flex-1">
                  Utworz
                </Button>
              </div>
            </form>
          )}

          {/* Back button if type selected */}
          {inventoryType && (
            <button
              type="button"
              onClick={() => setInventoryType(null)}
              className="text-sm text-slate-400 hover:text-white"
            >
              &larr; Zmien typ
            </button>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editingInventory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSaveEdit} className="glass-card p-6 w-full max-w-md animate-fade-in">
            <h3 className="font-medium text-white text-lg mb-4">Edytuj inwentaryzację</h3>
            <Input
              label="Nazwa"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingInventory(null)}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md animate-fade-in">
            <h3 className="font-medium text-white text-lg mb-2">Usuń inwentaryzację</h3>
            <p className="text-slate-400 mb-4">
              Czy na pewno chcesz usunąć inwentaryzację <span className="text-white font-medium">"{deleteConfirm.name}"</span>?
              {deleteConfirm.linesCount > 0 && (
                <span className="block mt-2 text-yellow-400">
                  Uwaga: Zostaną usunięte wszystkie pozycje ({deleteConfirm.linesCount}).
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDelete}
                loading={deleteMutation.isPending}
                className="flex-1"
              >
                Usuń
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Intro Inventory Confirmation Modal (ADMIN only - BIG WARNING) */}
      {deleteIntroConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md animate-fade-in border-2 border-red-500/50">
            {/* Big warning header */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-bold text-red-500 mb-2">UWAGA!</h3>
              <p className="text-lg text-white">Czy na pewno chcesz usunac inwentaryzacje?</p>
            </div>

            {/* Inventory details */}
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 mb-4">
              <div className="text-white font-medium text-lg mb-2">"{deleteIntroConfirm.name}"</div>
              <div className="text-slate-400 text-sm">
                <span className="text-red-400 font-medium">{deleteIntroConfirm.linesCount} produktow</span> zostanie usunietych
              </div>
              {deleteIntroConfirm.status === 'COMPLETED' && (
                <div className="text-yellow-400 text-sm mt-2 font-medium">
                  Ta inwentaryzacja jest ZAKONCZONA - produkty i stany magazynowe tez zostana usuniete!
                </div>
              )}
            </div>

            {/* Confirmation checkbox */}
            <label className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteConfirmCheckbox}
                onChange={(e) => setDeleteConfirmCheckbox(e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded border-red-500/50 bg-white/10 text-red-500 focus:ring-red-500"
              />
              <span className="text-white">
                Rozumiem, ze ta operacja jest <span className="text-red-400 font-bold">NIEODWRACALNA</span> i wszystkie dane zostana trwale usuniete
              </span>
            </label>

            {/* Confirmation text input */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">
                Wpisz <span className="text-red-400 font-bold">"potwierdzam"</span> aby usunac:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="potwierdzam"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-red-500/30 text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDeleteIntroConfirm(null);
                  setDeleteConfirmText('');
                  setDeleteConfirmCheckbox(false);
                }}
                className="flex-1"
              >
                Anuluj
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirmDeleteIntro}
                loading={deleteIntroMutation.isPending}
                disabled={!deleteConfirmCheckbox || deleteConfirmText.toLowerCase() !== 'potwierdzam'}
                className="flex-1"
              >
                USUN INWENTARYZACJE
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
        >
          <option value="">Wszystkie statusy</option>
          <option value="IN_PROGRESS">W trakcie</option>
          <option value="COMPLETED">Zakończone</option>
          <option value="CANCELLED">Anulowane</option>
        </select>
      </div>

      {/* List */}
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
          <ClipboardList className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Brak inwentaryzacji</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data.map((inv) => {
            const status = statusConfig[inv.status];
            return (
              <div
                key={inv.id}
                onClick={() => navigate(`/inventory/${inv.id}`)}
                className="glass-card p-4 w-full text-left hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-medium text-white">{inv.name}</div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleEdit(e, inv)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Edytuj"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, inv)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Usuń"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {inv.status === 'COMPLETED' && (
                      <button
                        onClick={(e) => handleExport(e, inv.id, inv.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                        title="Eksportuj do XLS"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <div className={clsx('flex items-center gap-1 ml-2', status.color)}>
                      {status.icon}
                      <span className="text-xs">{status.label}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    {inv.warehouse?.code} • {inv.linesCount} pozycji
                  </span>
                  <span className="text-slate-500 text-xs">
                    {format(new Date(inv.createdAt), 'd MMM HH:mm', { locale: pl })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Intro Inventories Section */}
      {introData && introData.data.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Inwentaryzacje nowych produktow
            </h3>
            {/* Export button for ADMIN */}
            {isAdmin && completedIntros.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowExportModal(true)}
                icon={<Download className="w-4 h-4" />}
              >
                Eksport ({selectedIntros.size > 0 ? selectedIntros.size : 'wybierz'})
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {introData.data.map((inv) => {
              const status = statusConfig[inv.status];
              const isSelected = selectedIntros.has(inv.id);
              const canSelect = isAdmin && inv.status === 'COMPLETED';

              return (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/inventory-intro/${inv.id}`)}
                  className={clsx(
                    'glass-card p-4 w-full text-left hover:bg-white/5 transition-colors cursor-pointer border-l-4',
                    isSelected ? 'border-primary-500 bg-primary-500/10' : 'border-green-500/50'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {/* Checkbox for ADMIN on completed inventories */}
                      {canSelect && (
                        <button
                          onClick={(e) => toggleIntroSelection(e, inv.id)}
                          className={clsx(
                            'w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0',
                            isSelected
                              ? 'bg-primary-500 border-primary-500'
                              : 'border-white/30 hover:border-white/50'
                          )}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </button>
                      )}
                      <div className="font-medium text-white">{inv.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Delete button for ADMIN */}
                      {isAdmin && (
                        <button
                          onClick={(e) => handleDeleteIntro(e, inv)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Usun inwentaryzacje"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <div className={clsx('flex items-center gap-1', status.color)}>
                        {status.icon}
                        <span className="text-xs">{status.label}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      {inv.warehouse?.code} • {inv._count?.lines || 0} produktow
                    </span>
                    <span className="text-slate-500 text-xs">
                      {format(new Date(inv.createdAt), 'd MMM HH:mm', { locale: pl })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export Modal for ADMIN */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 w-full max-w-md animate-fade-in">
            <h3 className="font-medium text-white text-lg mb-4">Eksport inwentaryzacji</h3>

            {selectedIntros.size === 0 ? (
              <div className="text-center py-4">
                <p className="text-slate-400 mb-4">
                  Zaznacz zakończone inwentaryzacje do eksportu używając checkboxów na liście.
                </p>
                <Button variant="secondary" onClick={() => setShowExportModal(false)}>
                  OK
                </Button>
              </div>
            ) : (
              <>
                <p className="text-slate-400 mb-4">
                  Wybrano <span className="text-white font-medium">{selectedIntros.size}</span> inwentaryzacji do eksportu.
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  Eksport zawiera: Lp., Zdjęcie, Nazwa, EAN, Ilość, Jedn., Cena brutto, CENA NETTO zakupu (brutto/1.23/2)
                </p>

                <div className="space-y-3">
                  <Button
                    onClick={handleExportExcel}
                    loading={exporting}
                    icon={<FileSpreadsheet className="w-5 h-5" />}
                    className="w-full"
                  >
                    Eksport do Excel (.xlsx)
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleExportCSV}
                    loading={exporting}
                    icon={<FileText className="w-5 h-5" />}
                    className="w-full"
                  >
                    Eksport do CSV
                  </Button>
                </div>

                <button
                  onClick={() => setShowExportModal(false)}
                  className="w-full mt-4 text-sm text-slate-400 hover:text-white"
                >
                  Anuluj
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

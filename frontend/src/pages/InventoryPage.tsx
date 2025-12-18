import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ClipboardList, Check, X, Clock, Download, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { inventoryService } from '../services/inventoryService';
import { warehousesService } from '../services/warehousesService';
import type { InventoryCount } from '../types';
import clsx from 'clsx';

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  IN_PROGRESS: { icon: <Clock className="w-4 h-4" />, label: 'W trakcie', color: 'text-yellow-400' },
  COMPLETED: { icon: <Check className="w-4 h-4" />, label: 'Zakończona', color: 'text-green-400' },
  CANCELLED: { icon: <X className="w-4 h-4" />, label: 'Anulowana', color: 'text-red-400' },
};

export default function InventoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ status: '' });
  const [newInventory, setNewInventory] = useState({ name: '', warehouseId: '' });
  const [editingInventory, setEditingInventory] = useState<InventoryCount | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<InventoryCount | null>(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getWarehouses({ limit: 100 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', filters],
    queryFn: () => inventoryService.getInventoryCounts({
      status: filters.status || undefined,
    }),
  });

  const createMutation = useMutation({
    mutationFn: inventoryService.createInventoryCount,
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inwentaryzacja utworzona');
      navigate(`/inventory/${inv.id}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd tworzenia');
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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInventory.name || !newInventory.warehouseId) {
      toast.error('Wypełnij wszystkie pola');
      return;
    }
    createMutation.mutate(newInventory);
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
        <form onSubmit={handleCreate} className="glass-card p-4 mb-4 space-y-3 animate-fade-in">
          <h3 className="font-medium text-white">Nowa inwentaryzacja</h3>
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
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
              Anuluj
            </Button>
            <Button type="submit" loading={createMutation.isPending} className="flex-1">
              Utwórz
            </Button>
          </div>
        </form>
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
    </Layout>
  );
}

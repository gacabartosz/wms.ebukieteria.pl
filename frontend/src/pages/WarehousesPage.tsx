import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Warehouse, Plus, Check, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { warehousesService } from '../services/warehousesService';
import clsx from 'clsx';

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ code: '', name: '', address: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getWarehouses({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: warehousesService.createWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      setShowForm(false);
      setFormData({ code: '', name: '', address: '' });
      toast.success('Magazyn utworzony');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd tworzenia');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; address?: string; isActive?: boolean } }) =>
      warehousesService.updateWarehouse(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Magazyn zaktualizowany');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd aktualizacji');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: warehousesService.deleteWarehouse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Magazyn usunięty');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd usuwania');
    },
  });

  const handleDelete = (id: string, code: string) => {
    if (window.confirm(`Czy na pewno chcesz usunąć magazyn ${code}?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      toast.error('Wypełnij wymagane pola');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    updateMutation.mutate({ id, data: { isActive: !currentStatus } });
  };

  return (
    <Layout
      title="Magazyny"
      actions={
        <Button size="sm" onClick={() => setShowForm(!showForm)} icon={<Plus className="w-4 h-4" />}>
          Dodaj
        </Button>
      }
    >
      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="glass-card p-4 mb-4 space-y-3 animate-fade-in">
          <h3 className="font-medium text-white">Nowy magazyn</h3>
          <Input
            label="Kod magazynu"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="np. PL1"
          />
          <Input
            label="Nazwa"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="np. Magazyn główny"
          />
          <Input
            label="Adres (opcjonalnie)"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            placeholder="np. ul. Logistyczna 1, Warszawa"
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

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-5 bg-white/10 rounded w-1/4 mb-2" />
              <div className="h-4 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : data?.data.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Warehouse className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Brak magazynów</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.data.map((wh) => (
            <div key={wh.id} className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-white text-lg">{wh.code}</span>
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      wh.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    )}>
                      {wh.isActive ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1">{wh.name}</p>
                  {wh.address && <p className="text-slate-500 text-sm">{wh.address}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(wh.id, wh.isActive)}
                    className={clsx(
                      'p-2 rounded-lg transition-colors',
                      wh.isActive
                        ? 'text-red-400 hover:bg-red-500/20'
                        : 'text-green-400 hover:bg-green-500/20'
                    )}
                    title={wh.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                  >
                    {wh.isActive ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id, wh.code)}
                    className="p-2 rounded-lg transition-colors text-red-400 hover:bg-red-500/20"
                    title="Usuń magazyn"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.pagination && (
        <div className="text-center text-sm text-slate-400 mt-4">
          Pokazano {data.data.length} z {data.pagination.total}
        </div>
      )}
    </Layout>
  );
}

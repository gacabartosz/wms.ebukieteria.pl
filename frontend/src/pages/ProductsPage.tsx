import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Search, Filter, Check, X, Upload, ChevronUp, ChevronDown, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import ImportModal, { ImportField } from '../components/ImportModal';
import ProductDetailModal from '../components/ProductDetailModal';
import { productsService } from '../services/productsService';
import { stockService } from '../services/stockService';
import type { Product } from '../types';
import clsx from 'clsx';

const importFields: ImportField[] = [
  { key: 'sku', label: 'SKU', required: true, example: 'PROD-001' },
  { key: 'name', label: 'Nazwa', required: true, example: 'Buty sportowe Nike' },
  { key: 'ean', label: 'EAN', required: false, example: '5901234123457' },
  { key: 'category', label: 'Kategoria', required: false, example: 'Obuwie' },
];

type SortField = 'sku' | 'name' | 'category' | 'stockQty' | 'priceNetto' | 'priceBrutto' | 'zone';
type SortDir = 'asc' | 'desc';

interface ProductWithStock extends Product {
  stockQty?: number;
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState({ search: '', category: '' });
  const [formData, setFormData] = useState({ sku: '', name: '', ean: '', category: '' });
  const [sortField, setSortField] = useState<SortField>('sku');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: productsService.getCategories,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => productsService.getProducts({
      search: filters.search || undefined,
      category: filters.category || undefined,
      limit: 500,
    }),
  });

  // Fetch stock data to show quantities
  const { data: stockData } = useQuery({
    queryKey: ['stock-all'],
    queryFn: () => stockService.getStock({ limit: 10000 }),
  });

  // Calculate stock totals by product
  const stockByProduct = useMemo(() => {
    const map = new Map<string, number>();
    stockData?.data?.forEach((stock) => {
      const productId = stock.product?.id;
      if (productId) {
        map.set(productId, (map.get(productId) || 0) + stock.qty);
      }
    });
    return map;
  }, [stockData]);

  const createMutation = useMutation({
    mutationFn: productsService.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowForm(false);
      setFormData({ sku: '', name: '', ean: '', category: '' });
      toast.success('Produkt utworzony');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd tworzenia');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isActive?: boolean } }) =>
      productsService.updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produkt zaktualizowany');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Błąd aktualizacji');
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sku || !formData.name) {
      toast.error('Wypełnij wymagane pola');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleToggleActive = (e: React.MouseEvent, id: string, currentStatus: boolean) => {
    e.stopPropagation();
    updateMutation.mutate({ id, data: { isActive: !currentStatus } });
  };

  const handleImport = async (importData: Record<string, string>[]) => {
    let success = 0;
    const errors: string[] = [];

    for (const row of importData) {
      try {
        await productsService.createProduct({
          sku: row.sku,
          name: row.name,
          ean: row.ean || undefined,
          category: row.category || undefined,
        });
        success++;
      } catch (error: any) {
        errors.push(`${row.sku}: ${error.response?.data?.error || 'Błąd'}`);
      }
    }

    queryClient.invalidateQueries({ queryKey: ['products'] });
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
      await productsService.exportToExcel();
      toast.success('Eksport zakończony');
    } catch {
      toast.error('Błąd eksportu');
    }
  };

  // Merge products with stock data and sort
  const productsWithStock: ProductWithStock[] = useMemo(() => {
    return (data?.data || []).map((product) => ({
      ...product,
      stockQty: stockByProduct.get(product.id) || 0,
    }));
  }, [data, stockByProduct]);

  // Sort products
  const sortedProducts = [...productsWithStock].sort((a, b) => {
    if (sortField === 'stockQty') {
      const diff = (a.stockQty || 0) - (b.stockQty || 0);
      return sortDir === 'asc' ? diff : -diff;
    }
    if (sortField === 'priceNetto' || sortField === 'priceBrutto') {
      const aVal = Number(a[sortField]) || 0;
      const bVal = Number(b[sortField]) || 0;
      const diff = aVal - bVal;
      return sortDir === 'asc' ? diff : -diff;
    }
    const aVal = a[sortField] || '';
    const bVal = b[sortField] || '';
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

  return (
    <Layout
      title="Produkty"
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
      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="glass-card p-4 mb-4 space-y-3 animate-fade-in">
          <h3 className="font-medium text-white">Nowy produkt</h3>
          <Input
            label="SKU"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
            placeholder="np. PROD-001"
          />
          <Input
            label="Nazwa"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="np. Buty sportowe Nike Air"
          />
          <Input
            label="EAN (opcjonalnie)"
            value={formData.ean}
            onChange={(e) => setFormData({ ...formData, ean: e.target.value })}
            placeholder="np. 5901234123457"
          />
          <Input
            label="Kategoria (opcjonalnie)"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="np. Obuwie"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Szukaj SKU, nazwy lub EAN..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
              />
            </div>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="">Wszystkie kategorie</option>
              {categoriesData?.data?.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card p-3 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Package className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Brak produktów</p>
        </div>
      ) : (
        <>
          {/* Desktop table view */}
          <div className="hidden md:block glass-card overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-2 py-3 text-left w-12"></th>
                  <th
                    className="px-2 py-3 text-left cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('sku')}
                  >
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-400 uppercase">
                      SKU <SortIcon field="sku" />
                    </div>
                  </th>
                  <th
                    className="px-2 py-3 text-left cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-400 uppercase">
                      Nazwa <SortIcon field="name" />
                    </div>
                  </th>
                  <th className="px-2 py-3 text-left">
                    <div className="text-xs font-medium text-slate-400 uppercase">EAN</div>
                  </th>
                  <th
                    className="px-2 py-3 text-left cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('zone')}
                  >
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-400 uppercase">
                      Mag <SortIcon field="zone" />
                    </div>
                  </th>
                  <th
                    className="px-2 py-3 text-right cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('priceNetto')}
                  >
                    <div className="flex items-center justify-end gap-1 text-xs font-medium text-slate-400 uppercase">
                      Netto <SortIcon field="priceNetto" />
                    </div>
                  </th>
                  <th
                    className="px-2 py-3 text-right cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('priceBrutto')}
                  >
                    <div className="flex items-center justify-end gap-1 text-xs font-medium text-slate-400 uppercase">
                      Brutto <SortIcon field="priceBrutto" />
                    </div>
                  </th>
                  <th className="px-2 py-3 text-center">
                    <div className="text-xs font-medium text-slate-400 uppercase">VAT</div>
                  </th>
                  <th
                    className="px-2 py-3 text-right cursor-pointer hover:bg-white/5"
                    onClick={() => handleSort('stockQty')}
                  >
                    <div className="flex items-center justify-end gap-1 text-xs font-medium text-slate-400 uppercase">
                      Stan <SortIcon field="stockQty" />
                    </div>
                  </th>
                  <th className="px-2 py-3 text-center">
                    <div className="text-xs font-medium text-slate-400 uppercase">Status</div>
                  </th>
                  <th className="px-2 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={clsx(
                      'border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5',
                      !product.isActive && 'opacity-50'
                    )}
                  >
                    <td className="px-2 py-2">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          className="w-8 h-8 rounded object-cover bg-white/5"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-500" />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span className="font-mono text-sm font-medium text-white">{product.sku}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-slate-300 text-sm truncate block max-w-[200px]" title={product.name}>{product.name}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className="text-slate-500 font-mono text-xs">{product.ean || '-'}</span>
                    </td>
                    <td className="px-2 py-2">
                      {product.zone ? (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                          {product.zone}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="text-slate-300 text-sm tabular-nums">
                        {product.priceNetto ? `${Number(product.priceNetto).toFixed(2)}` : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="text-white text-sm font-medium tabular-nums">
                        {product.priceBrutto ? `${Number(product.priceBrutto).toFixed(2)}` : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-slate-400 text-xs">
                        {product.vatRate ? `${product.vatRate}%` : '-'}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className={clsx(
                        'font-bold tabular-nums text-sm',
                        product.stockQty && product.stockQty > 0 ? 'text-green-400' : 'text-slate-500'
                      )}>
                        {product.stockQty || 0}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-xs font-medium',
                        product.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      )}>
                        {product.isActive ? 'Akt' : 'Nie'}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={(e) => handleToggleActive(e, product.id, product.isActive)}
                        className={clsx(
                          'p-1 rounded transition-colors',
                          product.isActive
                            ? 'text-red-400 hover:bg-red-500/20'
                            : 'text-green-400 hover:bg-green-500/20'
                        )}
                        title={product.isActive ? 'Dezaktywuj' : 'Aktywuj'}
                      >
                        {product.isActive ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list view */}
          <div className="md:hidden space-y-2">
            {sortedProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={clsx(
                  'glass-card p-3 cursor-pointer active:scale-[0.98] transition-transform',
                  !product.isActive && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover bg-white/5"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                      <Package className="w-6 h-6 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-white">{product.sku}</span>
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-xs font-medium',
                        product.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      )}>
                        {product.isActive ? 'Aktywny' : 'Nieaktywny'}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {product.category && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">
                          {product.category}
                        </span>
                      )}
                      {product.ean && (
                        <span className="text-slate-500 text-xs font-mono">{product.ean}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right mr-2">
                    <div className={clsx(
                      'text-lg font-bold tabular-nums',
                      product.stockQty && product.stockQty > 0 ? 'text-white' : 'text-slate-500'
                    )}>
                      {product.stockQty || 0}
                    </div>
                    <div className="text-xs text-slate-500">szt.</div>
                  </div>
                  <button
                    onClick={(e) => handleToggleActive(e, product.id, product.isActive)}
                    className={clsx(
                      'p-2 rounded-lg transition-colors',
                      product.isActive
                        ? 'text-red-400 hover:bg-red-500/20'
                        : 'text-green-400 hover:bg-green-500/20'
                    )}
                  >
                    {product.isActive ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data?.pagination && (
        <div className="text-center text-sm text-slate-400 mt-4">
          Pokazano {sortedProducts.length} z {data.pagination.total}
        </div>
      )}

      {/* Import modal */}
      <ImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImport}
        fields={importFields}
        title="Import produktów"
        templateFileName="produkty_szablon"
      />

      {/* Product detail modal */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </Layout>
  );
}

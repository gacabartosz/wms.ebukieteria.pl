import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, MapPin, Filter } from 'lucide-react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import { stockService } from '../services/stockService';
import { warehousesService } from '../services/warehousesService';

export default function StockPage() {
  const [showFilters, setShowFilters] = useState(false);
  const [warehouseId, setWarehouseId] = useState('');

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehousesService.getWarehouses({ limit: 100 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['stock', warehouseId],
    queryFn: () => stockService.getStock({
      warehouseId: warehouseId || undefined,
      limit: 100,
    }),
  });

  return (
    <Layout
      title="Stan magazynu"
      actions={
        <Button
          size="sm"
          variant={showFilters ? 'secondary' : 'ghost'}
          onClick={() => setShowFilters(!showFilters)}
          icon={<Filter className="w-4 h-4" />}
        >
          Filtry
        </Button>
      }
    >
      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-4 mb-4 animate-fade-in">
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
          >
            <option value="">Wszystkie magazyny</option>
            {warehousesData?.data.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} - {wh.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stock list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : data?.data.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Package className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400">Brak stanów magazynowych</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.data.map((stock) => (
            <div key={stock.id} className="glass-card p-3 flex items-center gap-3">
              {stock.product.imageUrl ? (
                <img
                  src={stock.product.imageUrl}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover bg-white/5"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
                  <Package className="w-6 h-6 text-slate-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{stock.product.sku}</div>
                <div className="text-xs text-slate-400 truncate">{stock.product.name}</div>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                  <MapPin className="w-3 h-3" />
                  <span>{stock.location.barcode}</span>
                  <span className="text-slate-600">•</span>
                  <span>{stock.location.warehouse?.code}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-white text-lg">{stock.qty}</div>
                <div className="text-xs text-slate-500">szt.</div>
              </div>
            </div>
          ))}

          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="text-center text-sm text-slate-400 pt-4">
              Strona {data.pagination.page} z {data.pagination.totalPages}
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

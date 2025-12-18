import { useQuery } from '@tanstack/react-query';
import { X, Package, MapPin, Loader2 } from 'lucide-react';
import { stockService } from '../services/stockService';
import type { Product } from '../types';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
}

export default function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['product-stock', product.sku],
    queryFn: () => stockService.getStockByCode({ productCode: product.sku }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Product header */}
        <div className="flex gap-4 mb-6">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-20 h-20 rounded-xl object-cover bg-white/5"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center">
              <Package className="w-10 h-10 text-slate-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-mono font-bold text-white text-lg">{product.sku}</div>
            <div className="text-slate-300">{product.name}</div>
            {product.ean && (
              <div className="text-sm text-slate-500 font-mono">EAN: {product.ean}</div>
            )}
            {product.category && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-slate-500/20 text-slate-400">
                {product.category}
              </span>
            )}
          </div>
        </div>

        {/* Total stock */}
        {data?.totalQty !== undefined && (
          <div className="mb-4 p-4 bg-primary-500/10 rounded-xl text-center">
            <div className="text-3xl font-bold text-white">{data.totalQty}</div>
            <div className="text-sm text-slate-400">Całkowity stan magazynowy</div>
          </div>
        )}

        {/* Stock by location */}
        <div>
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">
            Stan na lokalizacjach
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : !data?.stocks || data.stocks.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Brak produktu na magazynie</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(data.stocks as Array<{ location: { barcode: string; zone?: string; warehouse?: { code: string } }; qty: number }>).map((stock, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5">
                      <MapPin className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <div className="font-mono font-medium text-white">
                        {stock.location.barcode}
                      </div>
                      <div className="text-xs text-slate-500">
                        {stock.location.warehouse?.code}
                        {stock.location.zone && ` • Strefa ${stock.location.zone}`}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">{stock.qty}</div>
                    <div className="text-xs text-slate-500">szt.</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

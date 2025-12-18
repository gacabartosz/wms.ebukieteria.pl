import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, Package, MapPin, Box, Loader2 } from 'lucide-react';
import Layout from '../components/Layout';
import Button from '../components/Button';
import Input from '../components/Input';
import { stockService, StockByCodeResponse } from '../services/stockService';
import clsx from 'clsx';

export default function SearchPage() {
  const [searchType, setSearchType] = useState<'product' | 'location'>('product');
  const [searchValue, setSearchValue] = useState('');
  const [result, setResult] = useState<StockByCodeResponse | null>(null);

  const searchMutation = useMutation({
    mutationFn: () =>
      stockService.getStockByCode(
        searchType === 'product'
          ? { productCode: searchValue }
          : { locationBarcode: searchValue }
      ),
    onSuccess: (data) => {
      setResult(data);
    },
    onError: () => {
      setResult(null);
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    searchMutation.mutate();
  };

  return (
    <Layout title="Wyszukiwanie">
      {/* Search type toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setSearchType('product');
            setResult(null);
            setSearchValue('');
          }}
          className={clsx(
            'flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
            searchType === 'product'
              ? 'bg-primary-500 text-white'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          )}
        >
          <Package className="w-4 h-4" />
          Produkt
        </button>
        <button
          onClick={() => {
            setSearchType('location');
            setResult(null);
            setSearchValue('');
          }}
          className={clsx(
            'flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
            searchType === 'location'
              ? 'bg-primary-500 text-white'
              : 'bg-white/5 text-slate-400 hover:bg-white/10'
          )}
        >
          <MapPin className="w-4 h-4" />
          Lokalizacja
        </button>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="glass-card p-4 mb-4">
        <Input
          placeholder={
            searchType === 'product'
              ? 'Wpisz kod EAN lub SKU...'
              : 'Wpisz kod lokalizacji (np. PL1-01-01-01)...'
          }
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value.toUpperCase())}
          icon={<Search className="w-4 h-4" />}
          autoFocus
        />
        <Button
          type="submit"
          className="w-full mt-3"
          loading={searchMutation.isPending}
          disabled={!searchValue.trim()}
        >
          Szukaj
        </Button>
      </form>

      {/* Results */}
      {searchMutation.isPending && (
        <div className="glass-card p-8 text-center">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin mx-auto" />
          <p className="text-slate-400 mt-2">Szukam...</p>
        </div>
      )}

      {searchMutation.isError && (
        <div className="glass-card p-8 text-center">
          <Package className="w-12 h-12 text-red-400 mx-auto mb-2" />
          <p className="text-red-400">Nie znaleziono</p>
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-fade-in">
          {/* Product info */}
          {result.product && (
            <div className="glass-card p-4">
              <div className="flex items-start gap-4">
                {result.product.imageUrl ? (
                  <img
                    src={result.product.imageUrl}
                    alt=""
                    className="w-20 h-20 rounded-xl object-cover bg-white/5"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center">
                    <Package className="w-8 h-8 text-slate-500" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-bold text-white text-lg">{result.product.sku}</div>
                  <div className="text-slate-400">{result.product.name}</div>
                  {result.product.ean && (
                    <div className="text-slate-500 text-sm mt-1">EAN: {result.product.ean}</div>
                  )}
                </div>
                {result.totalQty !== undefined && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{result.totalQty}</div>
                    <div className="text-xs text-slate-400">Razem</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location info */}
          {result.location && (
            <div className="glass-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-primary-400" />
                </div>
                <div>
                  <div className="font-bold text-white text-lg">{result.location.barcode}</div>
                  <div className="text-slate-400 text-sm">
                    Strefa: {result.location.zone} • Status: {result.location.status}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stock list */}
          {result.stocks && result.stocks.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-400 mb-2 px-1">
                {searchType === 'product' ? 'Lokalizacje' : 'Produkty'} ({result.stocks.length})
              </h3>
              <div className="space-y-2">
                {result.stocks.map((stock, i) => (
                  <div key={i} className="glass-card p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {'location' in stock ? (
                        <>
                          <MapPin className="w-5 h-5 text-slate-400" />
                          <div>
                            <div className="text-white font-medium">{stock.location.barcode}</div>
                            <div className="text-xs text-slate-500">Strefa {stock.location.zone}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <Package className="w-5 h-5 text-slate-400" />
                          <div>
                            <div className="text-white font-medium">{stock.product.sku}</div>
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">
                              {stock.product.name}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="font-bold text-white text-lg">{stock.qty}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Single stock (product + location) */}
          {result.stock && (
            <div className="glass-card p-4 text-center">
              <Box className="w-12 h-12 text-primary-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">{result.stock.qty}</div>
              <div className="text-slate-400">sztuk w tej lokalizacji</div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}

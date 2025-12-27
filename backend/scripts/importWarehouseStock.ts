import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface StockRow {
  symbol: string;
  nazwa: string;
  stan: number;
  cenaMagazynowa: number;
  vatRate: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanEAN(symbol: string): string {
  let cleaned = symbol.replace(/"/g, '').trim();
  if (cleaned.includes(',') && /^\d+,\d+$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '');
  }
  return cleaned;
}

function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  // Zamień przecinek na kropkę (polski format)
  const cleaned = priceStr.replace(',', '.').replace(/[^\d.]/g, '');
  return parseFloat(cleaned) || 0;
}

async function importWarehouseStock(warehouseCode: string, csvFileName: string) {
  console.log(`\n📦 Import stanów dla magazynu: ${warehouseCode}`);
  console.log('='.repeat(50));

  // Znajdź magazyn
  const warehouse = await prisma.warehouse.findUnique({
    where: { code: warehouseCode },
  });

  if (!warehouse) {
    console.error(`❌ Nie znaleziono magazynu ${warehouseCode}`);
    return;
  }

  // Znajdź lub utwórz domyślną lokalizację dla magazynu
  let defaultLocation = await prisma.location.findFirst({
    where: { warehouseId: warehouse.id },
  });

  if (!defaultLocation) {
    // Utwórz domyślną lokalizację
    defaultLocation = await prisma.location.create({
      data: {
        barcode: `${warehouseCode}-01-01-01`,
        warehouseId: warehouse.id,
        zone: 'A',
        rack: '01',
        shelf: '01',
        level: '01',
      },
    });
    console.log(`✅ Utworzono domyślną lokalizację: ${defaultLocation.barcode}`);
  }

  // Wczytaj CSV
  const csvPath = path.join(__dirname, '..', csvFileName);
  console.log(`📂 Wczytywanie: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Plik nie istnieje: ${csvPath}`);
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Format: Rodzaj,Symbol,Nazwa,Grupa,Stan,jm,Cena magazynowa,Cena sprzedaży,Wartość magazynowa,Wartość sprzedaży,Stawka VAT
  const rows: StockRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 11) continue;

    const [_rodzaj, symbol, nazwa, _grupa, stanStr, _jm, cenaMag, _cenaSprz, _wartMag, _wartSprz, vatStr] = parts;

    if (!nazwa || nazwa.trim() === '') continue;

    const stan = parseInt(stanStr, 10) || 0;
    if (stan <= 0) continue; // Pomijamy produkty bez stanu

    rows.push({
      symbol: symbol,
      nazwa: nazwa.trim(),
      stan: stan,
      cenaMagazynowa: parsePrice(cenaMag),
      vatRate: parseInt(vatStr, 10) || 23,
    });
  }

  console.log(`📊 Znaleziono ${rows.length} produktów ze stanem > 0`);

  // Import stanów
  let imported = 0;
  let notFound = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      // Znajdź produkt po EAN lub nazwie
      let ean = cleanEAN(row.symbol);

      // Jeśli EAN jest pusty/0, szukaj po nazwie
      let product = null;

      if (ean && ean !== '0' && ean !== '' && !ean.startsWith('-')) {
        product = await prisma.product.findFirst({
          where: { ean: ean },
        });
      }

      if (!product) {
        // Szukaj po nazwie (jako EAN dla produktów bez kodu)
        product = await prisma.product.findFirst({
          where: {
            OR: [
              { ean: row.nazwa.substring(0, 50) },
              { name: row.nazwa },
            ]
          },
        });
      }

      if (!product) {
        notFound++;
        if (notFound <= 20) {
          console.log(`   ⚠️ Nie znaleziono produktu: "${row.nazwa}" (EAN: ${row.symbol})`);
        }
        continue;
      }

      // Aktualizuj cenę i VAT produktu
      await prisma.product.update({
        where: { id: product.id },
        data: {
          priceNetto: row.cenaMagazynowa > 0 ? row.cenaMagazynowa : undefined,
          vatRate: row.vatRate,
        },
      });
      updated++;

      // Utwórz lub zaktualizuj stan magazynowy
      const existingStock = await prisma.stock.findFirst({
        where: {
          productId: product.id,
          locationId: defaultLocation.id,
        },
      });

      if (existingStock) {
        await prisma.stock.update({
          where: { id: existingStock.id },
          data: { qty: existingStock.qty + row.stan },
        });
      } else {
        await prisma.stock.create({
          data: {
            productId: product.id,
            locationId: defaultLocation.id,
            qty: row.stan,
          },
        });
      }

      imported++;

      if (imported % 500 === 0) {
        console.log(`   Zaimportowano ${imported}/${rows.length}...`);
      }

    } catch (error: any) {
      errors++;
      if (errors <= 5) {
        console.error(`❌ Błąd: ${error.message}`);
      }
    }
  }

  console.log(`\n📊 Podsumowanie ${warehouseCode}:`);
  console.log(`   ✅ Stany zaimportowane: ${imported}`);
  console.log(`   📝 Produkty zaktualizowane: ${updated}`);
  console.log(`   ⚠️ Nie znaleziono: ${notFound}`);
  console.log(`   ❌ Błędy: ${errors}`);
}

async function main() {
  console.log('🚀 Import stanów magazynowych');
  console.log('==============================');

  // Sprawdź czy magazyny istnieją
  const warehouses = await prisma.warehouse.findMany();
  console.log(`📦 Magazyny w bazie: ${warehouses.map(w => w.code).join(', ')}`);

  // Import dla WOD
  await importWarehouseStock('WOD', 'WOD.csv');

  // Import dla TAR
  await importWarehouseStock('TAR', 'TAR.csv');

  console.log('\n==============================');
  console.log('✅ Import zakończony!');
}

main()
  .catch((e) => {
    console.error('❌ Błąd:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

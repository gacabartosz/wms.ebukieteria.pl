import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

function parsePolishDecimal(value: string): number {
  if (!value || value === '(brak)' || value.trim() === '') return 0;
  const cleaned = value.replace(',', '.').replace(/\s/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return num;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

async function importStock() {
  const csvPath = '/Users/gaca/Downloads/oh_party_all_v1 - all.csv';

  console.log('📦 Starting stock import from CSV...');

  // 1. Utwórz magazyny dla grh i wodna
  console.log('🏭 Creating warehouses...');

  const warehouseGrh = await prisma.warehouse.upsert({
    where: { code: 'GRH' },
    update: {},
    create: {
      code: 'GRH',
      name: 'Magazyn GRH',
      address: 'Magazyn GRH',
      isActive: true,
      isDefault: false,
    }
  });

  const warehouseWodna = await prisma.warehouse.upsert({
    where: { code: 'WODNA' },
    update: {},
    create: {
      code: 'WODNA',
      name: 'Magazyn Wodna',
      address: 'Magazyn Wodna',
      isActive: true,
      isDefault: false,
    }
  });

  console.log(`   ✅ Warehouse GRH: ${warehouseGrh.id}`);
  console.log(`   ✅ Warehouse WODNA: ${warehouseWodna.id}`);

  // 2. Utwórz domyślne lokalizacje dla każdego magazynu
  console.log('📍 Creating default locations...');

  const locationGrh = await prisma.location.upsert({
    where: { barcode: 'GRH-DEFAULT' },
    update: {},
    create: {
      barcode: 'GRH-DEFAULT',
      warehouseId: warehouseGrh.id,
      rack: '00',
      shelf: '00',
      level: '00',
      zone: 'DEFAULT',
      isActive: true,
    }
  });

  const locationWodna = await prisma.location.upsert({
    where: { barcode: 'WODNA-DEFAULT' },
    update: {},
    create: {
      barcode: 'WODNA-DEFAULT',
      warehouseId: warehouseWodna.id,
      rack: '00',
      shelf: '00',
      level: '00',
      zone: 'DEFAULT',
      isActive: true,
    }
  });

  console.log(`   ✅ Location GRH-DEFAULT: ${locationGrh.id}`);
  console.log(`   ✅ Location WODNA-DEFAULT: ${locationWodna.id}`);

  // 3. Wczytaj CSV i importuj stany
  console.log('📄 Reading CSV file...');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const dataLines = lines.slice(1);

  console.log(`📊 Found ${dataLines.length} rows to process`);

  // Pobierz wszystkie produkty z mapą SKU -> ID
  const products = await prisma.product.findMany({
    select: { id: true, sku: true }
  });
  const productMap = new Map(products.map(p => [p.sku, p.id]));

  console.log(`📦 Found ${productMap.size} products in database`);

  // Wyczyść istniejące stany
  console.log('🗑️ Clearing existing stock...');
  await prisma.stock.deleteMany({});

  let created = 0;
  let skipped = 0;
  let errors = 0;

  const stockToCreate: any[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line.trim()) continue;

    try {
      const fields = parseCsvLine(line);

      if (fields.length < 12) {
        skipped++;
        continue;
      }

      // CSV: Mag,Rodzaj,Symbol,Nazwa,Stan,Rezerwacja,Dostępne,J.m.,Detaliczna netto,Detaliczna brutto,Opis,FW
      const [mag, rodzaj, symbol, nazwa, stan, rezerwacja, dostepne, jm, nettoPrice, bruttoPrice, opis, fw] = fields;

      if (!symbol || !symbol.trim()) {
        skipped++;
        continue;
      }

      const sku = symbol.trim();
      const productId = productMap.get(sku);

      if (!productId) {
        skipped++;
        continue;
      }

      const qty = Math.floor(parsePolishDecimal(stan));
      if (qty <= 0) {
        skipped++;
        continue;
      }

      // Wybierz lokalizację na podstawie magazynu
      const locationId = mag?.toLowerCase() === 'wodna' ? locationWodna.id : locationGrh.id;

      // Unikaj duplikatów (ten sam produkt w tej samej lokalizacji)
      const key = `${productId}-${locationId}`;
      if (seenKeys.has(key)) {
        // Jeśli duplikat, dodaj do istniejącego stanu
        const existingIndex = stockToCreate.findIndex(s => s.productId === productId && s.locationId === locationId);
        if (existingIndex >= 0) {
          stockToCreate[existingIndex].qty += qty;
        }
        continue;
      }
      seenKeys.add(key);

      stockToCreate.push({
        productId,
        locationId,
        qty,
        containerId: null,
      });

      if (stockToCreate.length >= 500) {
        await prisma.stock.createMany({
          data: stockToCreate,
          skipDuplicates: true,
        });
        created += stockToCreate.length;
        stockToCreate.length = 0;
        console.log(`⏳ Progress: ${created} stock entries created`);
      }

    } catch (error) {
      errors++;
      console.error(`❌ Error on line ${i + 2}:`, error);
    }
  }

  // Pozostałe
  if (stockToCreate.length > 0) {
    await prisma.stock.createMany({
      data: stockToCreate,
      skipDuplicates: true,
    });
    created += stockToCreate.length;
  }

  console.log('\n✅ Stock import completed!');
  console.log(`   📥 Created: ${created} stock entries`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);

  // Podsumowanie
  const stockCount = await prisma.stock.count();
  const totalQty = await prisma.stock.aggregate({ _sum: { qty: true } });

  console.log(`\n📊 Summary:`);
  console.log(`   📦 Total stock entries: ${stockCount}`);
  console.log(`   📈 Total quantity: ${totalQty._sum.qty}`);

  // Sample
  console.log('\n📋 Sample stock:');
  const samples = await prisma.stock.findMany({
    take: 5,
    include: {
      product: { select: { sku: true, name: true } },
      location: { select: { barcode: true } }
    }
  });
  samples.forEach(s => {
    console.log(`   - ${s.product.sku} @ ${s.location.barcode}: ${s.qty} szt.`);
  });
}

async function main() {
  try {
    await importStock();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

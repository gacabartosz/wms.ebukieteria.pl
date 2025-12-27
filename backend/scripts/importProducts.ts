import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ProductRow {
  symbol: string;
  nazwa: string;
  stan: number;
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
  // Usuń cudzysłowy i białe znaki
  let cleaned = symbol.replace(/"/g, '').trim();

  // Jeśli to liczba z przecinkiem (np. "0,5904610115"), zamień przecinek na pusty string
  if (cleaned.includes(',') && /^\d+,\d+$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '');
  }

  return cleaned;
}

function generateSKU(index: number, name: string): string {
  // Generuj SKU z pierwszych liter nazwy + numer
  const prefix = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 3)
    .toUpperCase() || 'PRD';
  return `${prefix}${String(index).padStart(6, '0')}`;
}

async function main() {
  console.log('🚀 Import produktów z CALOSC.csv');
  console.log('================================');

  // 1. Wyczyść stare dane
  console.log('\n🗑️  Czyszczenie starych danych...');
  await prisma.auditLog.deleteMany({});
  await prisma.inventoryLine.deleteMany({});
  await prisma.inventoryCount.deleteMany({});
  await prisma.documentLine.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.stock.deleteMany({});
  await prisma.container.deleteMany({});
  await prisma.product.deleteMany({});
  console.log('✅ Stare produkty, stany i kontenery usunięte');

  // 2. Wczytaj plik CSV
  const csvPath = path.join(__dirname, '..', 'CALOSC.csv');
  console.log(`\n📂 Wczytywanie pliku: ${csvPath}`);

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  console.log(`📊 Znaleziono ${lines.length - 1} wierszy produktów`);

  // 3. Pomiń nagłówek i parsuj dane
  const products: ProductRow[] = [];
  const skippedLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = parseCSVLine(line);

    if (parts.length < 3) {
      skippedLines.push(`Linia ${i + 1}: za mało kolumn`);
      continue;
    }

    const [symbol, nazwa, stanStr] = parts;
    const stan = parseInt(stanStr, 10) || 0;

    if (!nazwa || nazwa.trim() === '') {
      skippedLines.push(`Linia ${i + 1}: brak nazwy`);
      continue;
    }

    products.push({
      symbol: symbol,
      nazwa: nazwa.trim(),
      stan: stan,
    });
  }

  console.log(`✅ Sparsowano ${products.length} produktów`);
  if (skippedLines.length > 0) {
    console.log(`⚠️  Pominięto ${skippedLines.length} wierszy`);
  }

  // 4. Import produktów do bazy
  console.log('\n📦 Importowanie produktów do bazy...');

  let imported = 0;
  let withoutEAN = 0;
  let errors = 0;
  const usedSKUs = new Set<string>();
  const usedEANs = new Set<string>();

  for (let i = 0; i < products.length; i++) {
    const prod = products[i];

    try {
      // Przygotuj EAN
      let ean = cleanEAN(prod.symbol);
      let needsBarcode = false;

      // Jeśli EAN jest pusty, "0" lub ujemny - użyj nazwy jako EAN
      if (!ean || ean === '0' || ean === '' || ean.startsWith('-')) {
        ean = prod.nazwa.substring(0, 50); // Max 50 znaków
        needsBarcode = true;
        withoutEAN++;
      }

      // Sprawdź duplikat EAN
      if (usedEANs.has(ean)) {
        // Dodaj suffix do EAN
        let suffix = 1;
        while (usedEANs.has(`${ean}_${suffix}`)) {
          suffix++;
        }
        ean = `${ean}_${suffix}`;
      }
      usedEANs.add(ean);

      // Generuj unikalny SKU
      let sku = generateSKU(i + 1, prod.nazwa);
      while (usedSKUs.has(sku)) {
        sku = `${sku}_${Math.random().toString(36).substring(7)}`;
      }
      usedSKUs.add(sku);

      // Przygotuj opis
      let description = '';
      if (needsBarcode) {
        description = '⚠️ BRAK KODU KRESKOWEGO - wymaga nadania EAN';
      }
      if (prod.stan > 0) {
        description += description ? ` | Stan początkowy: ${prod.stan}` : `Stan początkowy: ${prod.stan}`;
      }

      // Utwórz produkt
      await prisma.product.create({
        data: {
          sku: sku,
          ean: ean,
          name: prod.nazwa,
          description: description || null,
          unit: 'szt',
          isActive: true,
        },
      });

      imported++;

      // Progress
      if (imported % 500 === 0) {
        console.log(`   Zaimportowano ${imported}/${products.length}...`);
      }

    } catch (error: any) {
      errors++;
      if (errors <= 10) {
        console.error(`❌ Błąd przy produkcie "${prod.nazwa}": ${error.message}`);
      }
    }
  }

  console.log('\n================================');
  console.log('📊 PODSUMOWANIE IMPORTU');
  console.log('================================');
  console.log(`✅ Zaimportowano: ${imported} produktów`);
  console.log(`⚠️  Bez EAN (nazwa jako kod): ${withoutEAN}`);
  console.log(`❌ Błędy: ${errors}`);
  console.log('================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Błąd importu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

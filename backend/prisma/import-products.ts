import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

function parsePolishDecimal(value: string): Prisma.Decimal | null {
  if (!value || value === '(brak)' || value.trim() === '') return null;
  const cleaned = value.replace(',', '.').replace(/\s/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  return new Prisma.Decimal(num.toFixed(2));
}

function parseVatRate(value: string): number | null {
  if (!value || value === '(brak)' || value.trim() === '') return null;
  const num = parseInt(value, 10);
  if (isNaN(num)) return null;
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

async function importProducts() {
  const csvPath = '/Users/gaca/Downloads/oh_party_all_v1 - all.csv';

  console.log('📦 Starting full product import from CSV...');
  console.log(`📄 Reading file: ${csvPath}`);

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  // Skip header
  const dataLines = lines.slice(1);
  console.log(`📊 Found ${dataLines.length} rows to process`);

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  const seenSkus = new Set<string>();

  // Batch processing for better performance
  const batchSize = 100;
  const productsToCreate: any[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line.trim()) continue;

    try {
      const fields = parseCsvLine(line);

      if (fields.length < 12) {
        console.warn(`⚠️ Line ${i + 2}: Not enough fields (${fields.length}), skipping`);
        skipped++;
        continue;
      }

      // CSV columns: Mag,Rodzaj,Symbol,Nazwa,Stan,Rezerwacja,Dostępne,J.m.,Detaliczna netto,Detaliczna brutto,Opis,FW
      const [mag, rodzaj, symbol, nazwa, stan, rezerwacja, dostepne, jm, nettoPrice, bruttoPrice, opis, fw] = fields;

      if (!symbol || !symbol.trim()) {
        console.warn(`⚠️ Line ${i + 2}: Empty SKU, skipping`);
        skipped++;
        continue;
      }

      const sku = symbol.trim();

      // Skip duplicates in CSV (keep first occurrence)
      if (seenSkus.has(sku)) {
        skipped++;
        continue;
      }
      seenSkus.add(sku);

      // EAN = SKU (zawsze, bo użytkownik chce EAN wszędzie)
      const ean = sku;

      const productData = {
        sku,
        ean,
        name: nazwa?.trim() || sku,
        description: opis?.trim() && opis.trim() !== '(brak)' ? opis.trim() : null,
        unit: jm?.trim() || 'szt.',
        zone: mag?.trim() || null,
        category: rodzaj?.trim() || null,
        owner: null,
        priceNetto: parsePolishDecimal(nettoPrice),
        priceBrutto: parsePolishDecimal(bruttoPrice),
        vatRate: parseVatRate(fw),
        isActive: true,
      };

      productsToCreate.push(productData);

      // Process in batches
      if (productsToCreate.length >= batchSize) {
        await prisma.product.createMany({
          data: productsToCreate,
          skipDuplicates: true,
        });
        created += productsToCreate.length;
        productsToCreate.length = 0;

        if (created % 1000 === 0) {
          console.log(`⏳ Progress: ${created} created, ${skipped} skipped`);
        }
      }

    } catch (error) {
      errors++;
      console.error(`❌ Error on line ${i + 2}:`, error);
    }
  }

  // Process remaining products
  if (productsToCreate.length > 0) {
    await prisma.product.createMany({
      data: productsToCreate,
      skipDuplicates: true,
    });
    created += productsToCreate.length;
  }

  console.log('\n✅ Import completed!');
  console.log(`   📥 Created: ${created}`);
  console.log(`   🔄 Updated: ${updated}`);
  console.log(`   ⏭️  Skipped (duplicates): ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);

  const totalCount = await prisma.product.count();
  console.log(`   📦 Total in DB: ${totalCount}`);

  // Show sample data
  console.log('\n📋 Sample products:');
  const samples = await prisma.product.findMany({ take: 5 });
  samples.forEach(p => {
    console.log(`   - ${p.sku} | ${p.ean} | ${p.name} | ${p.priceNetto}/${p.priceBrutto} PLN | VAT ${p.vatRate}%`);
  });
}

async function main() {
  try {
    await importProducts();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

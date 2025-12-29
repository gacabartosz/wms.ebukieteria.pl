import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Parse CSV line handling quoted fields with commas
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

async function importPrices() {
  const csvPath = '/tmp/oh_party_all_v1 - all.csv';

  console.log('Reading CSV file...');
  const content = fs.readFileSync(csvPath, 'utf-8');

  // Split by lines and remove Windows line endings
  const lines = content.split('\n').map(line => line.replace(/\r/g, ''));

  console.log(`Found ${lines.length} lines in CSV`);

  // Parse header
  const header = parseCSVLine(lines[0]);
  console.log('CSV Columns:', header);

  // Find column indices
  const symbolIdx = header.findIndex(h => h.toLowerCase().includes('symbol'));
  const nettoIdx = header.findIndex(h => h.toLowerCase().includes('netto'));
  const bruttoIdx = header.findIndex(h => h.toLowerCase().includes('brutto'));

  console.log(`Column indices - Symbol: ${symbolIdx}, Netto: ${nettoIdx}, Brutto: ${bruttoIdx}`);

  // Skip header
  const dataLines = lines.slice(1).filter(line => line.trim());

  console.log(`Processing ${dataLines.length} data rows...`);

  // First, reset all prices
  console.log('Resetting all prices...');
  await prisma.product.updateMany({
    data: {
      priceNetto: null,
      priceBrutto: null,
    }
  });

  let updated = 0;
  let notFound = 0;
  let errors = 0;

  for (const line of dataLines) {
    const parts = parseCSVLine(line);

    const sku = parts[symbolIdx]?.trim();

    // Parse prices - replace comma with dot for Polish format
    const priceNettoStr = parts[nettoIdx]?.replace(',', '.').trim();
    const priceBruttoStr = parts[bruttoIdx]?.replace(',', '.').trim();

    if (!sku) continue;

    const priceNetto = parseFloat(priceNettoStr) || null;
    const priceBrutto = parseFloat(priceBruttoStr) || null;

    if (priceNetto === null && priceBrutto === null) continue;

    try {
      // Try to find product by SKU or EAN
      const product = await prisma.product.findFirst({
        where: {
          OR: [
            { sku: { equals: sku, mode: 'insensitive' } },
            { ean: sku }
          ]
        }
      });

      if (product) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            priceNetto: priceNetto,
            priceBrutto: priceBrutto,
          }
        });
        updated++;

        if (updated % 500 === 0) {
          console.log(`Updated ${updated} products...`);
        }
      } else {
        notFound++;
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`Error updating ${sku}:`, err);
      }
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Updated: ${updated}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Errors: ${errors}`);

  // Check result
  const withPrices = await prisma.product.count({
    where: {
      AND: [
        { priceNetto: { not: null } },
        { priceBrutto: { not: null } }
      ]
    }
  });

  const total = await prisma.product.count();
  console.log(`\nProducts with both prices: ${withPrices} / ${total}`);

  // Show sample
  const samples = await prisma.product.findMany({
    where: {
      priceNetto: { not: null },
      priceBrutto: { not: null }
    },
    take: 5,
    select: {
      sku: true,
      name: true,
      priceNetto: true,
      priceBrutto: true
    }
  });

  console.log('\nSample products:');
  samples.forEach(p => {
    console.log(`  ${p.sku}: netto=${p.priceNetto}, brutto=${p.priceBrutto}`);
  });
}

importPrices()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

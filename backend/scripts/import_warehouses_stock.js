const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const header = lines[0].split(',');

  console.log('Header columns:', header);

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row = {};
    header.forEach((col, idx) => {
      row[col.trim()] = values[idx] || '';
    });
    data.push(row);
  }

  return data;
}

function parseNumber(value) {
  if (!value || value === '(brak)') return 0;
  // Handle Polish decimal format (comma as decimal separator)
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseInteger(value) {
  if (!value || value === '(brak)') return 0;
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

async function main() {
  console.log('=== IMPORT MAGAZYNÓW I STANÓW ===\n');

  const csvPath = '/tmp/oh_party_all_v1 - all.csv';

  // 1. Parse CSV
  console.log('1. Parsowanie CSV...');
  const data = await parseCSV(csvPath);
  console.log(`   Znaleziono ${data.length} wierszy\n`);

  // 2. Get unique warehouses from CSV
  const warehouseCodes = [...new Set(data.map(r => r['Mag']).filter(Boolean))];
  console.log('2. Magazyny w CSV:', warehouseCodes);

  // 3. Create warehouses
  console.log('\n3. Tworzenie magazynów...');
  const warehouseMap = {};

  for (const code of warehouseCodes) {
    const warehouseName = code === 'grh' ? 'Magazyn GRH (główny)' :
                          code === 'wodna' ? 'Magazyn Wodna' :
                          `Magazyn ${code.toUpperCase()}`;

    let warehouse = await prisma.warehouse.findFirst({
      where: { code: code.toUpperCase() }
    });

    if (!warehouse) {
      warehouse = await prisma.warehouse.create({
        data: {
          code: code.toUpperCase(),
          name: warehouseName,
          address: '',
          isActive: true,
          isDefault: code === 'grh'
        }
      });
      console.log(`   ✓ Utworzono magazyn: ${warehouse.code} - ${warehouse.name}`);
    } else {
      console.log(`   - Magazyn już istnieje: ${warehouse.code}`);
    }

    warehouseMap[code] = warehouse.id;
  }

  // 4. Create default locations for each warehouse
  console.log('\n4. Tworzenie lokalizacji domyślnych...');
  const locationMap = {};

  for (const code of warehouseCodes) {
    const warehouseId = warehouseMap[code];
    const barcode = `${code.toUpperCase()}-DEFAULT`;

    let location = await prisma.location.findFirst({
      where: { barcode }
    });

    if (!location) {
      location = await prisma.location.create({
        data: {
          barcode,
          warehouseId,
          rack: '00',
          shelf: '00',
          level: '00',
          zone: code,
          status: 'ACTIVE',
          isActive: true
        }
      });
      console.log(`   ✓ Utworzono lokalizację: ${barcode}`);
    } else {
      console.log(`   - Lokalizacja już istnieje: ${barcode}`);
    }

    locationMap[code] = location.id;
  }

  // 5. Import stock data
  console.log('\n5. Importowanie stanów magazynowych...');

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of data) {
    const sku = row['Symbol'];
    const mag = row['Mag'];
    const stan = parseInteger(row['Stan']);
    const rezerwacja = parseInteger(row['Rezerwacja']);
    const dostepne = parseInteger(row['Dostępne']);

    if (!sku || !mag) {
      skipped++;
      continue;
    }

    try {
      // Find product by SKU
      const product = await prisma.product.findUnique({
        where: { sku }
      });

      if (!product) {
        skipped++;
        continue;
      }

      const locationId = locationMap[mag];
      if (!locationId) {
        skipped++;
        continue;
      }

      // Check if stock record exists
      const existingStock = await prisma.stock.findFirst({
        where: {
          productId: product.id,
          locationId: locationId
        }
      });

      if (existingStock) {
        // Update stock
        await prisma.stock.update({
          where: { id: existingStock.id },
          data: { qty: stan }
        });
        updated++;
      } else {
        // Create stock
        await prisma.stock.create({
          data: {
            productId: product.id,
            locationId: locationId,
            qty: stan
          }
        });
        created++;
      }

      // Update product with reservation info (store in description if needed)
      // For now, we're storing the available quantity as the main stock

    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`   Błąd dla SKU ${sku}: ${err.message}`);
      }
    }

    if ((created + updated) % 1000 === 0) {
      console.log(`   Przetworzono: ${created + updated} rekordów...`);
    }
  }

  console.log('\n=== PODSUMOWANIE ===');
  console.log(`Utworzono nowych stanów: ${created}`);
  console.log(`Zaktualizowano stanów: ${updated}`);
  console.log(`Pominięto: ${skipped}`);
  console.log(`Błędów: ${errors}`);

  // 6. Verify data
  console.log('\n=== WERYFIKACJA ===');

  const warehouses = await prisma.warehouse.findMany();
  console.log('\nMagazyny w bazie:');
  for (const w of warehouses) {
    const locationCount = await prisma.location.count({ where: { warehouseId: w.id } });
    console.log(`  ${w.code}: ${w.name} (${locationCount} lokalizacji)`);
  }

  const stockByWarehouse = await prisma.$queryRaw`
    SELECT w.code, w.name, COUNT(s.id) as stock_records, SUM(s.qty) as total_qty
    FROM "Warehouse" w
    LEFT JOIN "Location" l ON l."warehouseId" = w.id
    LEFT JOIN "Stock" s ON s."locationId" = l.id
    GROUP BY w.id, w.code, w.name
    ORDER BY w.code
  `;

  console.log('\nStany magazynowe:');
  for (const row of stockByWarehouse) {
    console.log(`  ${row.code}: ${row.stock_records} pozycji, łączna ilość: ${row.total_qty || 0}`);
  }

  // Check product zones vs stock locations
  const productZoneCheck = await prisma.$queryRaw`
    SELECT p.zone, COUNT(DISTINCT p.id) as products, COUNT(s.id) as stock_records
    FROM "Product" p
    LEFT JOIN "Stock" s ON s."productId" = p.id
    GROUP BY p.zone
    ORDER BY p.zone
  `;

  console.log('\nProdukty według stref (zone):');
  for (const row of productZoneCheck) {
    console.log(`  ${row.zone || '(brak)'}: ${row.products} produktów, ${row.stock_records} stanów`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

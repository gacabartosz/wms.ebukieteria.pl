const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const header = lines[0].split(',');

  console.log('Header columns:', header);

  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV with quotes handling
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
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

    if (values.length >= 11) {
      // Mag,Rodzaj,Symbol,Nazwa,Stan,Rezerwacja,Dostępne,J.m.,Detaliczna netto,Detaliczna brutto,Opis,FW
      const [mag, rodzaj, symbol, nazwa, stan, rezerwacja, dostepne, jm, nettoStr, bruttoStr, opis, fw] = values;

      // Parse prices (Polish format: "0,33" -> 0.33)
      const parsePrice = (str) => {
        if (!str || str === '') return null;
        const cleaned = str.replace(/"/g, '').replace(',', '.');
        const val = parseFloat(cleaned);
        return isNaN(val) ? null : val;
      };

      // Parse VAT rate
      const parseVat = (str) => {
        if (!str || str === '' || str === '(brak)') return null;
        const val = parseInt(str);
        return isNaN(val) ? null : val;
      };

      // Parse stock quantity (Polish format)
      const parseQty = (str) => {
        if (!str || str === '') return 0;
        const cleaned = str.replace(/"/g, '').replace(',', '.');
        const val = parseFloat(cleaned);
        return isNaN(val) ? 0 : Math.floor(val);
      };

      products.push({
        sku: symbol,
        ean: symbol, // Use symbol as EAN if it looks like EAN, otherwise same as SKU
        name: nazwa,
        description: opis || null,
        unit: jm || 'szt',
        zone: mag || null, // grh, wodna
        category: rodzaj || null, // towar
        priceNetto: parsePrice(nettoStr),
        priceBrutto: parsePrice(bruttoStr),
        vatRate: parseVat(fw),
        stock: parseQty(stan),
        reserved: parseQty(rezerwacja),
        available: parseQty(dostepne),
      });
    }
  }

  return products;
}

async function main() {
  console.log('Starting product import...');

  const csvPath = '/tmp/oh_party_all_v1 - all.csv';

  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath);
    process.exit(1);
  }

  console.log('Parsing CSV file...');
  const products = await parseCSV(csvPath);
  console.log(`Found ${products.length} products to import`);

  // Get or create default warehouse
  let warehouse = await prisma.warehouse.findFirst({ where: { isDefault: true } });
  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        code: 'MAIN',
        name: 'Magazyn główny',
        isDefault: true,
        isActive: true,
      }
    });
    console.log('Created default warehouse:', warehouse.code);
  }

  // Get or create default location
  let defaultLocation = await prisma.location.findFirst({
    where: { warehouseId: warehouse.id }
  });
  if (!defaultLocation) {
    defaultLocation = await prisma.location.create({
      data: {
        barcode: 'LOC-DEFAULT',
        warehouseId: warehouse.id,
        rack: 'A',
        shelf: '1',
        level: '1',
        zone: 'DEFAULT',
        status: 'ACTIVE',
      }
    });
    console.log('Created default location:', defaultLocation.barcode);
  }

  let created = 0;
  let updated = 0;
  let errors = 0;
  let stocksCreated = 0;

  // Process in batches
  const batchSize = 100;

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    for (const product of batch) {
      try {
        // Check if product exists
        const existing = await prisma.product.findUnique({
          where: { sku: product.sku }
        });

        const productData = {
          sku: product.sku,
          ean: product.ean,
          name: product.name,
          description: product.description,
          unit: product.unit,
          zone: product.zone,
          category: product.category,
          priceNetto: product.priceNetto,
          priceBrutto: product.priceBrutto,
          vatRate: product.vatRate,
          isActive: true,
        };

        let savedProduct;
        if (existing) {
          savedProduct = await prisma.product.update({
            where: { id: existing.id },
            data: productData,
          });
          updated++;
        } else {
          savedProduct = await prisma.product.create({
            data: productData,
          });
          created++;
        }

        // Create or update stock if quantity > 0
        if (product.stock > 0) {
          const existingStock = await prisma.stock.findFirst({
            where: {
              productId: savedProduct.id,
              locationId: defaultLocation.id,
              containerId: null,
            }
          });

          if (existingStock) {
            await prisma.stock.update({
              where: { id: existingStock.id },
              data: { qty: product.stock }
            });
          } else {
            await prisma.stock.create({
              data: {
                productId: savedProduct.id,
                locationId: defaultLocation.id,
                qty: product.stock,
              }
            });
            stocksCreated++;
          }
        }

      } catch (error) {
        errors++;
        if (errors <= 10) {
          console.error(`Error importing product ${product.sku}:`, error.message);
        }
      }
    }

    // Progress
    const progress = Math.min(100, Math.round((i + batch.length) / products.length * 100));
    process.stdout.write(`\rProgress: ${progress}% (${i + batch.length}/${products.length})`);
  }

  console.log('\n\n=== Import Summary ===');
  console.log(`Created: ${created} products`);
  console.log(`Updated: ${updated} products`);
  console.log(`Stocks created: ${stocksCreated}`);
  console.log(`Errors: ${errors}`);
  console.log('Import completed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

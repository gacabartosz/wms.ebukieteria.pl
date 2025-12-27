import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('Admin123!', 10);
  const userPassword = await bcrypt.hash('abc123', 10);

  const admin = await prisma.user.upsert({
    where: { phone: '+48000000001' },
    update: {},
    create: {
      phone: '+48000000001',
      password: hashedPassword,
      name: 'Administrator',
      role: 'ADMIN',
    },
  });
  console.log('✅ Admin user created:', admin.phone);

  // Create manager user
  const manager = await prisma.user.upsert({
    where: { phone: '+48000000002' },
    update: {},
    create: {
      phone: '+48000000002',
      password: hashedPassword,
      name: 'Kierownik Magazynu',
      role: 'MANAGER',
    },
  });
  console.log('✅ Manager user created:', manager.phone);

  // Create warehouse worker
  const worker = await prisma.user.upsert({
    where: { phone: '+48000000003' },
    update: {},
    create: {
      phone: '+48000000003',
      password: hashedPassword,
      name: 'Jan Magazynier',
      role: 'WAREHOUSE',
    },
  });
  console.log('✅ Warehouse worker created:', worker.phone);

  // Create user1-user5 with password abc123
  const users = [
    { phone: 'user1', name: 'Użytkownik 1', role: 'WAREHOUSE' as const },
    { phone: 'user2', name: 'Użytkownik 2', role: 'WAREHOUSE' as const },
    { phone: 'user3', name: 'Użytkownik 3', role: 'WAREHOUSE' as const },
    { phone: 'user4', name: 'Użytkownik 4', role: 'WAREHOUSE' as const },
    { phone: 'user5', name: 'Użytkownik 5', role: 'WAREHOUSE' as const },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { phone: user.phone },
      update: { password: userPassword },
      create: {
        phone: user.phone,
        password: userPassword,
        name: user.name,
        role: user.role,
      },
    });
  }
  console.log('✅ Created users: user1, user2, user3, user4, user5 (password: abc123)');

  // Create warehouses - eBukieteria
  const warehousePLO = await prisma.warehouse.upsert({
    where: { code: 'PLO' },
    update: {},
    create: {
      code: 'PLO',
      name: 'Płonica',
      address: 'Płonica',
      isDefault: true,
    },
  });
  console.log('✅ Warehouse created:', warehousePLO.code);

  const warehouseWOD = await prisma.warehouse.upsert({
    where: { code: 'WOD' },
    update: {},
    create: {
      code: 'WOD',
      name: 'Wodna',
      address: 'ul. Wodna',
    },
  });
  console.log('✅ Warehouse created:', warehouseWOD.code);

  const warehouseTAR = await prisma.warehouse.upsert({
    where: { code: 'TAR' },
    update: {},
    create: {
      code: 'TAR',
      name: 'Targowa',
      address: 'ul. Targowa',
    },
  });
  console.log('✅ Warehouse created:', warehouseTAR.code);

  // Create warehouses
  const warehouse1 = await prisma.warehouse.upsert({
    where: { code: 'PL1' },
    update: {},
    create: {
      code: 'PL1',
      name: 'Magazyn Główny Poznań',
      address: 'ul. Magazynowa 1, 60-001 Poznań',
    },
  });
  console.log('✅ Warehouse created:', warehouse1.code);

  const warehouse2 = await prisma.warehouse.upsert({
    where: { code: 'WA1' },
    update: {},
    create: {
      code: 'WA1',
      name: 'Magazyn Warszawa',
      address: 'ul. Logistyczna 10, 02-001 Warszawa',
    },
  });
  console.log('✅ Warehouse created:', warehouse2.code);

  // Create locations for PLO warehouse (PLO-01-01-01 to PLO-01-01-05)
  for (let level = 1; level <= 5; level++) {
    const barcode = `PLO-01-01-${level.toString().padStart(2, '0')}`;
    await prisma.location.upsert({
      where: { barcode },
      update: {},
      create: {
        barcode,
        warehouseId: warehousePLO.id,
        zone: 'A',
        rack: '01',
        shelf: '01',
        level: level.toString().padStart(2, '0'),
      },
    });
  }
  console.log('✅ Created locations: PLO-01-01-01 to PLO-01-01-05');

  // Create locations for PL1 warehouse
  const zones = ['A', 'B', 'C'];
  const locationsCreated: string[] = [];

  for (const zone of zones) {
    for (let rack = 1; rack <= 5; rack++) {
      for (let shelf = 1; shelf <= 4; shelf++) {
        for (let level = 1; level <= 3; level++) {
          const barcode = `PL1-${rack.toString().padStart(2, '0')}-${shelf.toString().padStart(2, '0')}-${level.toString().padStart(2, '0')}`;

          await prisma.location.upsert({
            where: { barcode },
            update: {},
            create: {
              barcode,
              warehouseId: warehouse1.id,
              zone,
              rack: rack.toString().padStart(2, '0'),
              shelf: shelf.toString().padStart(2, '0'),
              level: level.toString().padStart(2, '0'),
            },
          });
          locationsCreated.push(barcode);
        }
      }
    }
  }
  console.log(`✅ Created ${locationsCreated.length} locations for ${warehouse1.code}`);

  // Create some locations for WA1 warehouse
  for (let rack = 1; rack <= 3; rack++) {
    for (let shelf = 1; shelf <= 3; shelf++) {
      for (let level = 1; level <= 2; level++) {
        const barcode = `WA1-${rack.toString().padStart(2, '0')}-${shelf.toString().padStart(2, '0')}-${level.toString().padStart(2, '0')}`;

        await prisma.location.upsert({
          where: { barcode },
          update: {},
          create: {
            barcode,
            warehouseId: warehouse2.id,
            zone: 'A',
            rack: rack.toString().padStart(2, '0'),
            shelf: shelf.toString().padStart(2, '0'),
            level: level.toString().padStart(2, '0'),
          },
        });
      }
    }
  }
  console.log(`✅ Created locations for ${warehouse2.code}`);

  // Create sample products
  const products = [
    { sku: 'NIKE-AM90-BLK-42', name: 'Nike Air Max 90 Black', ean: '1234567890123' },
    { sku: 'NIKE-AM90-WHT-42', name: 'Nike Air Max 90 White', ean: '1234567890124' },
    { sku: 'NIKE-AM90-RED-42', name: 'Nike Air Max 90 Red', ean: '1234567890125' },
    { sku: 'ADIDAS-UB22-BLK-43', name: 'Adidas Ultraboost 22 Black', ean: '2345678901234' },
    { sku: 'ADIDAS-UB22-WHT-43', name: 'Adidas Ultraboost 22 White', ean: '2345678901235' },
    { sku: 'PUMA-RS-X-BLK-41', name: 'Puma RS-X Black', ean: '3456789012345' },
    { sku: 'NB-574-GRY-42', name: 'New Balance 574 Grey', ean: '4567890123456' },
    { sku: 'REEBOK-CL-WHT-44', name: 'Reebok Classic White', ean: '5678901234567' },
    { sku: 'CONVERSE-AS-BLK-40', name: 'Converse All Star Black', ean: '6789012345678' },
    { sku: 'VANS-OS-BLK-41', name: 'Vans Old Skool Black', ean: '7890123456789' },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }
  console.log(`✅ Created ${products.length} sample products`);

  // Create sample containers (kuwety)
  const containerBarcodes = ['K000001', 'K000002', 'K000003', 'K000004', 'K000005', 'K000006', 'K000007', 'K000008', 'K000009', 'K000010'];
  const containerLocations = ['PL1-01-01-01', 'PL1-01-01-02', 'PL1-01-02-01', 'PL1-02-01-01', null, null, null, null, null, null]; // Some without location

  for (let i = 0; i < containerBarcodes.length; i++) {
    const barcode = containerBarcodes[i];
    const locationBarcode = containerLocations[i];

    let locationId: string | null = null;
    if (locationBarcode) {
      const location = await prisma.location.findUnique({ where: { barcode: locationBarcode } });
      locationId = location?.id || null;
    }

    await prisma.container.upsert({
      where: { barcode },
      update: {},
      create: {
        barcode,
        name: `Kuweta ${barcode}`,
        locationId,
      },
    });
  }
  console.log(`✅ Created ${containerBarcodes.length} sample containers`);

  // Add some initial stock (with and without containers)
  const stockData = [
    // Stock without container (directly on shelf)
    { sku: 'NIKE-AM90-BLK-42', locationBarcode: 'PL1-01-01-01', containerBarcode: null, qty: 10 },
    { sku: 'NIKE-AM90-WHT-42', locationBarcode: 'PL1-01-01-02', containerBarcode: null, qty: 15 },
    { sku: 'ADIDAS-UB22-BLK-43', locationBarcode: 'PL1-01-02-01', containerBarcode: null, qty: 20 },
    // Stock in containers
    { sku: 'NIKE-AM90-RED-42', locationBarcode: 'PL1-01-01-01', containerBarcode: 'K000001', qty: 5 },
    { sku: 'PUMA-RS-X-BLK-41', locationBarcode: 'PL1-01-01-01', containerBarcode: 'K000001', qty: 8 },
    { sku: 'ADIDAS-UB22-WHT-43', locationBarcode: 'PL1-01-01-02', containerBarcode: 'K000002', qty: 12 },
    { sku: 'NB-574-GRY-42', locationBarcode: 'PL1-01-02-01', containerBarcode: 'K000003', qty: 6 },
    { sku: 'REEBOK-CL-WHT-44', locationBarcode: 'PL1-02-01-01', containerBarcode: 'K000004', qty: 25 },
  ];

  for (const item of stockData) {
    const product = await prisma.product.findFirst({ where: { sku: item.sku } });
    const location = await prisma.location.findUnique({ where: { barcode: item.locationBarcode } });
    let containerId: string | null = null;

    if (item.containerBarcode) {
      const container = await prisma.container.findUnique({ where: { barcode: item.containerBarcode } });
      containerId = container?.id || null;
    }

    if (product && location) {
      // Check if stock already exists
      const existing = await prisma.stock.findFirst({
        where: { productId: product.id, locationId: location.id, containerId },
      });

      if (existing) {
        await prisma.stock.update({
          where: { id: existing.id },
          data: { qty: item.qty },
        });
      } else {
        await prisma.stock.create({
          data: {
            productId: product.id,
            locationId: location.id,
            containerId,
            qty: item.qty,
          },
        });
      }
    }
  }
  console.log('✅ Added initial stock (with and without containers)');

  // Create settings
  await prisma.settings.upsert({
    where: { id: 'main' },
    update: {},
    create: {
      id: 'main',
      companyName: 'WMS Demo',
      data: {
        defaultWarehouseId: warehouse1.id,
      },
    },
  });

  console.log('✅ Settings created');

  console.log('🎉 Seeding completed!');
  console.log('\n📋 Login credentials:');
  console.log('   Admin: +48000000001 / Admin123!');
  console.log('   Manager: +48000000002 / Admin123!');
  console.log('   Worker: +48000000003 / Admin123!');
  console.log('   user1: user1 / abc123');
  console.log('   user2: user2 / abc123');
  console.log('   user3: user3 / abc123');
  console.log('   user4: user4 / abc123');
  console.log('   user5: user5 / abc123');
  console.log('\n📦 Warehouses:');
  console.log('   PLO - Płonica');
  console.log('   WOD - Wodna');
  console.log('   TAR - Targowa');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

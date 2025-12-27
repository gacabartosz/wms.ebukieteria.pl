import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  console.log('🗑️  Cleaning old data...');

  // Delete old data in correct order (respecting foreign keys)
  await prisma.auditLog.deleteMany({});
  await prisma.inventoryLine.deleteMany({});
  await prisma.inventoryCount.deleteMany({});
  await prisma.documentLine.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.stock.deleteMany({});
  await prisma.container.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.warehouse.deleteMany({});

  console.log('✅ Old data cleaned');

  // Create passwords
  const userPassword = await bcrypt.hash('abc123', 10);

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
  const warehousePLO = await prisma.warehouse.create({
    data: {
      code: 'PLO',
      name: 'Płonica',
      address: 'Płonica',
      isDefault: true,
    },
  });
  console.log('✅ Warehouse created:', warehousePLO.code);

  const warehouseWOD = await prisma.warehouse.create({
    data: {
      code: 'WOD',
      name: 'Wodna',
      address: 'ul. Wodna',
    },
  });
  console.log('✅ Warehouse created:', warehouseWOD.code);

  const warehouseTAR = await prisma.warehouse.create({
    data: {
      code: 'TAR',
      name: 'Targowa',
      address: 'ul. Targowa',
    },
  });
  console.log('✅ Warehouse created:', warehouseTAR.code);

  // Create locations for PLO warehouse (PLO-01-01-01 to PLO-01-01-05)
  for (let level = 1; level <= 5; level++) {
    const barcode = `PLO-01-01-${level.toString().padStart(2, '0')}`;
    await prisma.location.create({
      data: {
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

  // Create settings
  await prisma.settings.upsert({
    where: { id: 'main' },
    update: { data: { defaultWarehouseId: warehousePLO.id } },
    create: {
      id: 'main',
      companyName: 'eBukieteria WMS',
      data: {
        defaultWarehouseId: warehousePLO.id,
      },
    },
  });
  console.log('✅ Settings created');

  console.log('🎉 Seeding completed!');
  console.log('\n📋 Login credentials:');
  console.log('   user1: user1 / abc123');
  console.log('   user2: user2 / abc123');
  console.log('   user3: user3 / abc123');
  console.log('   user4: user4 / abc123');
  console.log('   user5: user5 / abc123');
  console.log('\n📦 Warehouses:');
  console.log('   PLO - Płonica (default)');
  console.log('   WOD - Wodna');
  console.log('   TAR - Targowa');
  console.log('\n📍 Locations:');
  console.log('   PLO-01-01-01 to PLO-01-01-05');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

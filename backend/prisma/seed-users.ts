import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding users...');

  // Hash passwords
  const adminPassword = await bcrypt.hash('admin123', 12);
  const workerPassword = await bcrypt.hash('12345', 12);

  // First delete all dependent data
  console.log('Deleting dependent data...');
  await prisma.inventoryLine.deleteMany({});
  await prisma.inventoryIntroLine.deleteMany({});
  await prisma.inventoryIntro.deleteMany({});
  await prisma.inventoryCount.deleteMany({});
  await prisma.documentLine.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.auditLog.deleteMany({});

  // Delete all existing users
  await prisma.user.deleteMany({});
  console.log('Deleted existing users');

  // Create Admin
  await prisma.user.create({
    data: {
      username: 'Admin',
      name: 'Administrator',
      password: adminPassword,
      role: 'ADMIN',
      permissions: [],
      isActive: true,
    },
  });
  console.log('Created Admin user');

  // Worker names (pierwsza duża litera, reszta małe)
  const workers = [
    'Iwona',
    'Jola',
    'Natalka',
    'Vlada',
    'Anita',
    'Ewelina',
    'Tatiana',
    'Teresa',
    'Wioletta',
    'Kinga',
    'Ania',
    'Violetta',
  ];

  // Create workers
  for (const name of workers) {
    await prisma.user.create({
      data: {
        username: name,
        name: name,
        password: workerPassword,
        role: 'WAREHOUSE',
        permissions: [],
        isActive: true,
      },
    });
    console.log(`Created worker: ${name}`);
  }

  console.log('Done! Created 13 users total.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

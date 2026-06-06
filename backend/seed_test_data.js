const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Seeding test users and game results...');

    // 1. Create a test user
    const user = await prisma.user.upsert({
      where: { username: 'testuser' },
      update: {},
      create: {
        username: 'testuser',
        password: 'password123', // In a real app, this would be hashed
      },
    });
    console.log(`User created: ${user.username} (ID: ${user.id})`);

    // 2. Create some fake game results for this user
    const results = [
      { word: 'APPLE', success: true, attempts: 3, userId: user.id },
      { word: 'BEACH', success: true, attempts: 5, userId: user.id },
      { word: 'CLOUD', success: false, attempts: 6, userId: user.id },
      { word: 'DREAM', success: true, attempts: 2, userId: user.id },
      { word: 'EARTH', success: false, attempts: 6, userId: user.id },
    ];

    await prisma.gameResult.createMany({ data: results });
    console.log(`Created ${results.length} game results for ${user.username}.`);

  } catch (error) {
    console.error('Error seeding test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

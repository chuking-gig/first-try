const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    const data = fs.readFileSync('words_list.txt', 'utf8');
    const words = data
      .split('\n')
      .map(w => w.trim())
      .filter(w => w.length === 5)
      .map(w => ({ text: w.toUpperCase() }));

    await prisma.word.deleteMany({});
    await prisma.word.createMany({ data: words });
    console.log(`Successfully seeded ${words.length} words.`);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

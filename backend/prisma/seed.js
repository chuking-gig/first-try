const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");
  const words = ["APPLE", "WORLD", "HELLO", "PRISM"];
  for (const text of words) {
    await prisma.word.upsert({
      where: { text },
      update: {},
      create: { text },
    });
    console.log(`Upserted ${text}`);
  }
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
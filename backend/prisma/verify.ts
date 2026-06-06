const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const words = await prisma.word.findMany();
  console.log("Words in DB:", words);
}

main();
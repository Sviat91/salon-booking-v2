const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const masters = await prisma.user.findMany({ where: { role: 'MASTER' } });
  console.log("Masters:", JSON.stringify(masters.map(m => m.id), null, 2));

  const schedules = await prisma.schedule.findMany();
  console.log("Schedules:", JSON.stringify(schedules, null, 2));

  const overrides = await prisma.dateOverride.findMany();
  console.log("Overrides:", JSON.stringify(overrides, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

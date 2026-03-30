const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.schedule.deleteMany({}); // Ensure no templates
  console.log("Deleted all templates");

  const masters = await prisma.user.findMany({ where: { role: 'MASTER' } });
  const masterId = masters[0].id;
  
  const fromISO = '2026-04-01';
  const untilISO = '2026-04-05';
  
  // mock the availability logic 
  const from = new Date(fromISO + 'T00:00:00');
  const until = new Date(untilISO + 'T23:59:59');
  
  const overrides = await prisma.dateOverride.findMany({
    where: { masterId, date: { gte: from, lte: until } }
  });
  
  console.log("DB Overrides found:", overrides.length);
  for (const o of overrides) {
    console.log("  ", o.date.toISOString(), o.intervals);
  }
}
main().finally(() => { prisma.$disconnect(); process.exit(0); });

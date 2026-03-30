const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const masters = await prisma.user.findMany({ where: { role: 'MASTER' } });
  console.log("Masters:", JSON.stringify(masters, null, 2));
  const schedules = await prisma.schedule.findMany();
  console.log("Schedules:", JSON.stringify(schedules, null, 2));
}
main().finally(() => prisma.$disconnect());

import { getAvailableDays, getDaySlots } from './src/lib/availability';
import prisma from './src/lib/prisma';

async function main() {
  const masters = await prisma.user.findMany({ where: { role: 'MASTER' } });
  const m = masters[0].id;
  
  const days = await getAvailableDays('2026-03-30', '2026-04-05', 60, { masterId: m });
  console.log("DAYS:", JSON.stringify(days, null, 2));

  const slots = await getDaySlots('2026-04-01', 60, 15, m);
  console.log("SLOTS on April 1:", JSON.stringify(slots, null, 2));
}

main().finally(() => process.exit(0));

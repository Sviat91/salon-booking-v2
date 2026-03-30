const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Starting schedule seed...");
  
  // Get all masters
  const masters = await prisma.user.findMany({
    where: { role: 'MASTER' }
  });
  
  console.log(`Found ${masters.length} masters`);
  
  for (const master of masters) {
    console.log(`Setting default schedule for master: ${master.name || master.id}`);
    
    // Check if they already have schedules
    const existing = await prisma.schedule.count({
      where: { masterId: master.id }
    });
    
    if (existing > 0) {
      console.log(`Master already has ${existing} schedule entries. Skipping.`);
      continue;
    }
    
    // Create Mon-Fri 09:00-18:00, Sat-Sun day off
    for (let day = 0; day <= 6; day++) {
      const isWeekend = day === 0 || day === 6;
      await prisma.schedule.create({
        data: {
          masterId: master.id,
          dayOfWeek: day,
          isDayOff: isWeekend,
          intervals: isWeekend ? "[]" : JSON.stringify([{ start: "09:00", end: "18:00" }])
        }
      });
    }
    console.log(`Created 7 schedule entries for master: ${master.id}`);
  }
  
  console.log("Done!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // Create SuperAdmin (if not exists)
  const adminEmail = 'admin@somique.com'
  const adminPassword = await bcrypt.hash('password123', 10)

  let admin = await prisma.user.findFirst({ where: { email: adminEmail } })
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Super Admin',
        password: adminPassword,
        role: 'SUPERADMIN',
      },
    })
  }
  console.log(`Created superadmin: ${admin.email}`)

  // Create a Demo Master (if not exists)
  const masterEmail = 'master@somique.com'
  const masterPassword = await bcrypt.hash('master123', 10)

  let master = await prisma.user.findFirst({ where: { email: masterEmail } })
  if (!master) {
    master = await prisma.user.create({
      data: {
        email: masterEmail,
        name: 'Demo Master',
        password: masterPassword,
        role: 'MASTER',
        masterProfile: {
          create: {
            bio: 'Demo master for testing...',
            title: 'Senior Specialist'
          }
        }
      },
    })
  }
  console.log(`Created demo master: ${master.email}`)

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

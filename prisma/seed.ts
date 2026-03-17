import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Start seeding...')

  // Create SuperAdmin
  const adminEmail = 'admin@somique.com'
  const adminPassword = await bcrypt.hash('password123', 10)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Super Admin',
      password: adminPassword,
      role: 'SUPERADMIN',
    },
  })
  console.log(`Created superadmin: ${admin.email}`)

  // Create a Demo Master
  const masterEmail = 'master@somique.com'
  const masterPassword = await bcrypt.hash('master123', 10)

  const master = await prisma.user.upsert({
    where: { email: masterEmail },
    update: {},
    create: {
      email: masterEmail,
      name: 'Demo Master',
      password: masterPassword,
      role: 'MASTER',
      masterProfile: {
        create: {
          bio: 'Demo master for testing...'
        }
      }
    },
  })
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

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const EMAIL = "admin@salon.local"
const PASSWORD = "Admin1234!"
const NAME = "Super Admin"

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } })
  if (existing) {
    console.log("SUPERADMIN already exists:", existing.email)
    return
  }

  const hashed = await bcrypt.hash(PASSWORD, 12)
  const user = await prisma.user.create({
    data: {
      name: NAME,
      email: EMAIL,
      password: hashed,
      role: "SUPERADMIN",
    },
  })

  console.log("✓ SUPERADMIN created")
  console.log("  Email:   ", EMAIL)
  console.log("  Password:", PASSWORD)
  console.log("  ID:      ", user.id)
  console.log("")
  console.log("Login at: http://localhost:3000/auth/login")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

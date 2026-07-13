import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"

const prisma = new PrismaClient()

const USAGE =
  'Usage: npx tsx scripts/create-admin.ts --email=admin@example.com --password=SecurePass123 --name="Admin Name"'

const argsSchema = z.object({
  email: z.string().email("must be a valid email"),
  password: z.string().min(6, "must be at least 6 characters").max(100),
  name: z.string().min(1, "is required").max(100),
})

function parseArgs(): Record<string, string> {
  const result: Record<string, string> = {}
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/)
    if (match) result[match[1]] = match[2]
  }
  return result
}

async function main() {
  const parsed = argsSchema.safeParse(parseArgs())

  if (!parsed.success) {
    console.error(USAGE)
    console.error("")
    for (const issue of parsed.error.issues) {
      console.error(`  --${issue.path.join(".")} ${issue.message}`)
    }
    process.exit(1)
  }

  const { email, password, name } = parsed.data

  // This script only bootstraps the very first SUPERADMIN — once one exists,
  // use the admin panel's Admins page to create further ADMIN accounts.
  const existingSuperadmin = await prisma.user.findFirst({ where: { role: "SUPERADMIN" } })
  if (existingSuperadmin) {
    console.error(`A SUPERADMIN already exists (${existingSuperadmin.email}).`)
    console.error("This script only bootstraps the first admin account — sign in and use the admin panel's Admins page to add more.")
    process.exit(1)
  }

  const existingEmail = await prisma.user.findFirst({ where: { email } })
  if (existingEmail) {
    console.error(`A user with email ${email} already exists.`)
    process.exit(1)
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed, role: "SUPERADMIN" },
  })

  console.log("SUPERADMIN created")
  console.log("  Email:", email)
  console.log("  Name: ", name)
  console.log("  ID:   ", user.id)
  console.log("")
  console.log("Login at: /auth/login")
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

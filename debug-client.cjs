const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Update the existing "Test" user to "Sviat" for testing
  const result = await p.user.update({
    where: { id: 'cmnoolq450000cqgjov65kywg' },
    data: { name: 'Sviat' },
  })
  console.log('Updated user:', result.id, result.name, result.phone)
}

main().finally(() => p.$disconnect())

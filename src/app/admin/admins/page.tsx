import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import AdminsClient from "./AdminsClient"

export default async function AdminsPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPERADMIN") redirect("/admin")

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true, email: true, adminPermissions: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  return <AdminsClient admins={admins} />
}

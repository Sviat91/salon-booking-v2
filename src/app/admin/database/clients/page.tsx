import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { getPermissionsForRole, ALL_PERMISSIONS } from "@/lib/admin-permissions"
import ClientsTable from "./ClientsTable"

export default async function ClientsPage() {
  const session = await auth()
  if (!session?.user) redirect("/auth/login")
  if (!["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) redirect("/admin")

  let rawPermissions: string | null | undefined = undefined
  if (session.user.role === "ADMIN") {
    const u = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { adminPermissions: true },
    })
    rawPermissions = u?.adminPermissions
  }

  const permissions =
    session.user.role === "SUPERADMIN"
      ? ALL_PERMISSIONS
      : getPermissionsForRole(session.user.role ?? "", rawPermissions)

  if (!permissions.clients.view) redirect("/admin")

  const clients = await prisma.user.findMany({
    where: { role: "CLIENT" },
    select: { id: true, name: true, phone: true, email: true, createdAt: true, isGuest: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return <ClientsTable clients={clients} permissions={permissions} />
}

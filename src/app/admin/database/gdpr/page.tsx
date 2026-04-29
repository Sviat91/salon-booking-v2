import { auth } from "@/auth"
import { redirect } from "next/navigation"
import prisma from "@/lib/prisma"
import { getPermissionsForRole, ALL_PERMISSIONS } from "@/lib/admin-permissions"
import GdprTable from "./GdprTable"

export default async function GdprPage() {
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

  if (!permissions.gdpr.view) redirect("/admin")

  const records = await prisma.consentRecord.findMany({
    orderBy: { consentDate: "desc" },
    take: 100,
    select: {
      id: true,
      fullName: true,
      phoneDigits: true,
      email: true,
      consentDate: true,
      consentWithdrawnDate: true,
      erasureDate: true,
      consentPrivacyV10: true,
      userId: true,
    },
  })

  return <GdprTable records={records} permissions={permissions} />
}

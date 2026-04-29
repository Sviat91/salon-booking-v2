import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function DatabasePage() {
  const session = await auth()
  if (!session?.user) redirect("/auth/login")
  if (!["ADMIN", "SUPERADMIN"].includes(session.user.role ?? "")) redirect("/admin")
  redirect("/admin/database/clients")
}

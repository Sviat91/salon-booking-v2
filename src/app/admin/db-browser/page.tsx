import { auth } from "@/auth"
import { redirect } from "next/navigation"
import DbBrowserClient from "./DbBrowserClient"

export default async function DbBrowserPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== "SUPERADMIN") redirect("/admin")
  return <DbBrowserClient />
}

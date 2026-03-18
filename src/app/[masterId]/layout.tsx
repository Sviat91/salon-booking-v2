import { getTenantConfig } from '@/lib/tenant'

export default async function MasterLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { masterId: string }
}) {
  const config = await getTenantConfig()
  
  return (
    <>
      {children}
    </>
  )
}

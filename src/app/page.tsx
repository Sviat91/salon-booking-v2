import { getTenantConfig } from '@/lib/tenant'
import HomeClient from '@/components/home/HomeClient'

export default async function HomePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const config = await getTenantConfig()
  const isPreview = searchParams.preview === '1'

  return <HomeClient config={config} isPreview={isPreview} />
}

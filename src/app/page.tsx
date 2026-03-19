import { getCachedReviews } from '@/lib/reviews'
import { getTenantConfig } from '@/lib/tenant'
import HomeClient from '@/components/home/HomeClient'

export default async function HomePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const reviews = await getCachedReviews()
  const config = await getTenantConfig()
  const isPreview = searchParams.preview === '1'

  return <HomeClient initialReviews={reviews} config={config} isPreview={isPreview} />
}

import { getCachedReviews } from '@/lib/reviews'
import { getTenantConfig } from '@/lib/tenant'
import HomeClient from '@/components/home/HomeClient'

export default async function HomePage() {
  const reviews = await getCachedReviews()
  const config = await getTenantConfig()

  return <HomeClient initialReviews={reviews} config={config} />
}

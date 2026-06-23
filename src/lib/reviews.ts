export interface ReviewImage {
  id: string
  url: string
  thumbnailUrl?: string
}

export async function listReviewImages(): Promise<ReviewImage[]> {
  return []
}

export async function getCachedReviews(): Promise<ReviewImage[]> {
  return []
}

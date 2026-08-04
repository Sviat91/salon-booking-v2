/**
 * Client-side image downscaling for oversized uploads.
 *
 * Browser-only utility (Canvas API) — must only be imported from "use client" code.
 */
export async function resizeImageIfNeeded(file: File, maxDimension = 2000): Promise<File> {
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = new Image()
    let width: number
    let height: number
    try {
      ;({ width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
        img.onerror = reject
        img.src = objectUrl
      }))
    } catch {
      // Unreadable/corrupt file — let the existing upload flow's own
      // validation (and its error UX) handle it, rather than throwing an
      // unhandled promise rejection here.
      return file
    }

    if (width <= maxDimension && height <= maxDimension) {
      return file
    }

    const scale = maxDimension / Math.max(width, height)
    const targetWidth = Math.round(width * scale)
    const targetHeight = Math.round(height * scale)

    const canvas = document.createElement("canvas")
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, file.type, 0.9)
    })
    if (!blob) return file

    return new File([blob], file.name, { type: file.type })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

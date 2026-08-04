import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { auth } from "@/auth"

// Allowed MIME types for uploads
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]
const MAX_SIZE_BYTES = 4 * 1024 * 1024 // 4 MB

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !["ADMIN", "MASTER", "SUPERADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided", code: "VALIDATION_ERROR" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPEG, WebP, GIF and SVG images are allowed", code: "INVALID_FILE_TYPE" },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File is too large (max 4 MB)", code: "FILE_TOO_LARGE" },
      { status: 400 }
    )
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Build a unique filename: timestamp + sanitised original name
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png"
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  await mkdir(uploadsDir, { recursive: true })

  await writeFile(path.join(uploadsDir, safeName), buffer)

  // Return the public URL path
  return NextResponse.json({ url: `/uploads/${safeName}` })
}

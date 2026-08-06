import { ImageResponse } from 'next/og'
import { getTenantConfig } from '@/lib/tenant'
import { DEFAULT_BRAND_NAME } from '@/lib/constants/brand'
import { OG_SIZE, brandFontSize, loadOgLogo, resolveUploadPath, safeColor, truncateBrandName } from '@/lib/og-image'

// Node.js, not edge: the card reads the uploaded logo off the container's
// own disk and normalises it with sharp. `next/og` has a real Node build.
export const runtime = 'nodejs'
// Same reason as /api/tenant-config: without this, Next prerenders the PNG
// at build time (the Docker builder stage has no live DB) and `next start`
// then serves that frozen card forever.
export const dynamic = 'force-dynamic'
export const size = OG_SIZE
export const contentType = 'image/png'

// Mirror src/lib/tenant.ts's DEFAULT_CONFIG palette for the never-happens case
// of a non-hex value in the DB.
const FALLBACK_FROM = '#FFF0F1'
const FALLBACK_TO = '#FFF8F6'
const FALLBACK_ACCENT = '#8B4A58'

export default async function OpengraphImage() {
  const config = await getTenantConfig()
  const from = safeColor(config.primaryColor, FALLBACK_FROM)
  const to = safeColor(config.secondaryColor, FALLBACK_TO)
  const accent = safeColor(config.accentColor, FALLBACK_ACCENT)
  const brandName = truncateBrandName(config.brandName, DEFAULT_BRAND_NAME)

  const logoPath = resolveUploadPath(config.logoUrl)
  const logo = logoPath ? await loadOgLogo(logoPath) : null

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 80,
          background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        }}
      >
        {logo ? (
          <img src={logo.dataUrl} width={logo.width} height={logo.height} alt="" />
        ) : (
          <div
            style={{
              display: 'flex',
              maxWidth: 1000,
              fontSize: brandFontSize(brandName),
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              textAlign: 'center',
              color: accent,
            }}
          >
            {brandName}
          </div>
        )}
      </div>
    ),
    {
      ...OG_SIZE,
      // ImageResponse defaults to `immutable, max-age=31536000` in production,
      // but the URL's ?<hash> is a hash of THIS FILE, not of TenantConfig — so
      // an immutable card would survive every logo/palette change.
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    },
  )
}

// Ported from the real LogoDisplay.tsx, simplified: the real component reads
// admin-configurable position/size/layer from TenantConfig (draggable in the
// "Customize" window, not built yet) and separate light/dark logo assets.
// This demo has one logo asset and uses the real component's own defaults
// (posX/Y 0%, 200×80, top layer) — desktop only, absolutely positioned in
// the corner space TopNavLine already reserves via `leadingSpaceClassName`.
const LOGO_SRC = '/logo.png'

export default function LogoDisplay() {
  return (
    <div className="hidden lg:block z-10" style={{ position: 'absolute', left: '0%', top: '0%' }}>
      <img src={LOGO_SRC} alt="Loom & Blade" width={200} height={80} className="h-auto" />
    </div>
  )
}

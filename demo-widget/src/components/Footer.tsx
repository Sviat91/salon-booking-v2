// Legal/support pages aren't part of this demo pass — links are inert
// (real Footer.tsx wraps these in next/link to /privacy, /terms, /support).
export default function Footer() {
  return (
    <footer className="py-3">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <div className="text-sm text-neutral-500 dark:text-dark-muted">
            <span className="hover:text-primary transition-colors cursor-default">Privacy Policy</span>
            <span className="mx-2">•</span>
            <span className="hover:text-primary transition-colors cursor-default">Terms of Service</span>
            <span className="mx-2">•</span>
            <span className="hover:text-primary transition-colors cursor-default">Support</span>
            <span className="mx-4">|</span>
            <span>© {new Date().getFullYear()} Loom & Blade. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

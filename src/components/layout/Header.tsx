import Link from "next/link"
import { getTenantConfig } from "@/lib/tenant"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/ThemeToggle"

export default async function Header() {
  const config = await getTenantConfig()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            {/* If there's a logo URL, we could show it here, else fallback to brandName */}
            {config.logoUrl ? (
              <img src={config.logoUrl} alt={config.brandName} className="h-8 w-auto" />
            ) : (
              <span className="font-bold inline-block text-xl tracking-tight text-primary">
                {config.brandName}
              </span>
            )}
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link
              href="/"
              className="flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground/80"
            >
              Главная
            </Link>
          </nav>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            <ThemeToggle />
            <Link href="/admin">
              <Button variant="ghost" className="hidden sm:inline-flex">
                Панель управления
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

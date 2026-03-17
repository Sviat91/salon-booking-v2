"use client"

import { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  // Sync state with the actual <html> class after hydration
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggle() {
    const html = document.documentElement
    const nowDark = html.classList.toggle("dark")
    setIsDark(nowDark)
    try {
      localStorage.setItem("theme", nowDark ? "dark" : "light")
    } catch {
      // localStorage can be blocked in some environments
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="h-8 w-8"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Moon className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  )
}

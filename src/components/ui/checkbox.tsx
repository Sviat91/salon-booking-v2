"use client"

import * as React from "react"
import { Check } from "lucide-react"

type CheckboxProps = {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
}

export function Checkbox({ checked, onCheckedChange, className = "" }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      className={`h-4 w-4 shrink-0 rounded-[4px] border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-background hover:bg-primary/8"
      } ${className}`}
    >
      {checked && <Check className="h-3 w-3" />}
    </button>
  )
}

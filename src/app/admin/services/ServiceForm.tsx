"use client"

import { useEffect } from "react"
import { useFormState, useFormStatus } from "react-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createService, updateService, type ServiceFormState } from "./actions"

type Service = { id: string; name: string; duration: number; price: number }

interface ServiceFormProps {
  service?: Service
  onSuccess: () => void
}

const initialState: ServiceFormState = {}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="mt-2">
      {pending ? "Saving…" : label}
    </Button>
  )
}

export default function ServiceForm({ service, onSuccess }: ServiceFormProps) {
  const action = service
    ? updateService.bind(null, service.id)
    : createService

  const [state, formAction] = useFormState(action, initialState)

  useEffect(() => {
    if (state.success) onSuccess()
  }, [state.success, onSuccess])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="name">Service Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={service?.name}
          placeholder="e.g. Classic Manicure"
          required
        />
        {state.fieldErrors?.name && (
          <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input
          id="duration"
          name="duration"
          type="number"
          min={5}
          max={480}
          defaultValue={service?.duration ?? 60}
          required
        />
        {state.fieldErrors?.duration && (
          <p className="text-xs text-destructive">
            {state.fieldErrors.duration[0]}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="price">Price (zł)</Label>
        <Input
          id="price"
          name="price"
          type="number"
          min={0}
          step={0.01}
          defaultValue={service?.price ?? ""}
          placeholder="0.00"
          required
        />
        {state.fieldErrors?.price && (
          <p className="text-xs text-destructive">{state.fieldErrors.price[0]}</p>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <SubmitButton label={service ? "Update Service" : "Add Service"} />
    </form>
  )
}

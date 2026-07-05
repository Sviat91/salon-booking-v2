"use client"

import { X, Calendar, Clock, User, Phone, Scissors, Trash2, Copy, Edit3, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format, parseISO } from "date-fns"
import type { Appointment } from "./ModernCalendar"
import { useState } from "react"

interface Props {
  appointment: Appointment
  onClose: () => void
  onDelete: (id: string) => Promise<void>
  onEdit: (appointment: Appointment) => void
  onDuplicate: (appointment: Appointment) => void
}

export default function ViewAppointmentModal({ appointment, onClose, onDelete, onEdit, onDuplicate }: Props) {
  const [isDeleting, setIsDeleting] = useState(false)
  const formattedServicePrice =
    appointment.service.price > 0
      ? new Intl.NumberFormat("pl-PL", {
          style: "currency",
          currency: "PLN",
          minimumFractionDigits: Number.isInteger(appointment.service.price) ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(appointment.service.price)
      : ""

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this appointment?")) return
    setIsDeleting(true)
    try {
      await onDelete(appointment.id)
    } catch {
      alert("Failed to delete appointment")
      setIsDeleting(false)
    }
  }

  const apptDate = parseISO(appointment.date)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-start p-5 border-b border-border bg-card">
          <div className="flex gap-4 items-center">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">Booking Details</h2>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{appointment.status}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-3">
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary shrink-0">
                  <User className="w-4 h-4" />
               </div>
               <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Client</p>
                  <p className="font-semibold text-lg">{appointment.client.name || "Guest"}</p>
               </div>
             </div>
             {appointment.client.phone && (
               <div className="flex items-center gap-3 pl-11 text-sm text-muted-foreground">
                 <Phone className="w-4 h-4" /> {appointment.client.phone}
               </div>
             )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 bg-muted/20 p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Date</p>
              <p className="font-semibold">{format(apptDate, "EEEE, MMM d, yyyy")}</p>
            </div>
            <div className="space-y-1 bg-muted/20 p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> Time</p>
              <p className="font-semibold">{appointment.startTime} - {appointment.endTime}</p>
            </div>
          </div>

          <div className="bg-muted/20 rounded-lg p-4 border border-border">
            <p className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5"/> Service</p>
            <div className="flex justify-between items-center">
              <p className="font-semibold text-base">{appointment.service.name}</p>
              <p className="font-bold text-primary">{formattedServicePrice}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{appointment.service.duration} minutes</p>
          </div>

          {appointment.notes && (
            <div className="bg-muted/20 rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/> Notes</p>
              <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-border bg-muted/10 flex flex-wrap gap-3 sm:flex-nowrap">
           <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(appointment)}>
             <Edit3 className="w-4 h-4" /> Edit
           </Button>
           <Button variant="outline" className="flex-1 gap-2" onClick={() => onDuplicate(appointment)}>
             <Copy className="w-4 h-4" /> Copy
           </Button>
           <Button
             variant="destructive"
             className="flex-1 gap-2"
             onClick={handleDelete}
             disabled={isDeleting}
           >
             <Trash2 className="w-4 h-4" /> {isDeleting ? "Deleting..." : "Delete"}
           </Button>
        </div>

      </div>
    </div>
  )
}

"use client"

import { X, Calendar, Clock, User, Phone, Scissors, Trash2, Copy, Edit3, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format, parseISO } from "date-fns"
import type { Appointment } from "./ModernCalendar"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import { dateFnsLocale } from "@/lib/utils/date-fns-locale"
import { toast } from "sonner"

interface Props {
  appointment: Appointment
  onClose: () => void
  onDelete: (id: string) => Promise<void>
  onEdit: (appointment: Appointment) => void
  onDuplicate: (appointment: Appointment) => void
}

export default function ViewAppointmentModal({ appointment, onClose, onDelete, onEdit, onDuplicate }: Props) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const statusLabel = (status: string) => {
    if (status === "PENDING") return t('profile.statusPending')
    if (status === "CONFIRMED") return t('profile.statusConfirmed')
    if (status.startsWith("CANCELLED")) return t('profile.statusCancelled')
    return status
  }
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
    setIsDeleting(true)
    try {
      await onDelete(appointment.id)
    } catch {
      toast.error(t('admin.calendar.deleteAppointmentFailed'))
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
              <h2 className="text-xl font-bold leading-tight">{t('admin.calendar.bookingDetailsTitle')}</h2>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">{statusLabel(appointment.status)}</p>
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
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('admin.appointments.colClient')}</p>
                  <p className="font-semibold text-lg">{appointment.client.name || t('admin.calendar.guestFallback')}</p>
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
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> {t('admin.calendar.dateLabel')}</p>
              <p className="font-semibold">{format(apptDate, "EEEE, MMM d, yyyy", { locale: dateFnsLocale(language) })}</p>
            </div>
            <div className="space-y-1 bg-muted/20 p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5"/> {t('admin.calendar.timeFieldLabel')}</p>
              <p className="font-semibold">{appointment.startTime} - {appointment.endTime}</p>
            </div>
          </div>

          <div className="bg-muted/20 rounded-lg p-4 border border-border">
            <p className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1.5"><Scissors className="w-3.5 h-3.5"/> {t('admin.appointments.colService')}</p>
            <div className="flex justify-between items-center">
              <p className="font-semibold text-base">{resolveLocalized({ pl: appointment.service.name_pl, en: appointment.service.name_en, uk: appointment.service.name_uk }, language)}</p>
              <p className="font-bold text-primary">{formattedServicePrice}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{appointment.service.duration} {t('admin.calendar.minutesSuffix')}</p>
          </div>

          {appointment.notes && (
            <div className="bg-muted/20 rounded-lg p-4 border border-border">
              <p className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5"/> {t('admin.calendar.notesFieldLabel')}</p>
              <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-border bg-muted/10 flex flex-wrap gap-3 sm:flex-nowrap">
           <Button variant="outline" className="flex-1 gap-2" onClick={() => onEdit(appointment)}>
             <Edit3 className="w-4 h-4" /> {t('admin.calendar.editBtn')}
           </Button>
           <Button variant="outline" className="flex-1 gap-2" onClick={() => onDuplicate(appointment)}>
             <Copy className="w-4 h-4" /> {t('admin.calendar.copyBtn')}
           </Button>
           <Button
             variant="destructive"
             className="flex-1 gap-2"
             onClick={() => setShowDeleteConfirm(true)}
             disabled={isDeleting}
           >
             <Trash2 className="w-4 h-4" /> {isDeleting ? t('admin.calendar.deletingBtn') : t('admin.calendar.deleteBtn')}
           </Button>
        </div>

      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-background rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold">{t('admin.calendar.deleteConfirmTitle')}</h3>
            <p className="text-sm text-muted-foreground">{t('admin.calendar.deleteAppointmentConfirm')}</p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t('admin.calendar.deletingBtn') : t('admin.calendar.deleteBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

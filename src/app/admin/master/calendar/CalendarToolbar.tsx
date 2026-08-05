"use client"

import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight, Edit3, Save, Calendar, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useState } from "react"
import type { ViewType, AdminMasterListItem } from "./ModernCalendar"
import MasterSelectDropdown from "./MasterSelectDropdown"

interface CalendarToolbarProps {
  view: ViewType
  setView: (v: ViewType) => void
  step: number
  setStep: (n: number) => void
  navigate: (direction: "prev" | "next" | "today") => void
  headerDisplay: string
  todayDisplay: string
  isEditMode: boolean
  setIsEditMode: (v: boolean) => void
  setShowBulkModal: (v: boolean) => void
  loading: boolean
  isMobile: boolean
  isAdminView?: boolean
  selectedMasterId?: string
  adminMastersList?: AdminMasterListItem[]
  onMasterChange?: (id: string) => void
}

export default function CalendarToolbar({
  view,
  setView,
  step,
  setStep,
  navigate,
  headerDisplay,
  todayDisplay,
  isEditMode,
  setIsEditMode,
  setShowBulkModal,
  loading,
  isMobile,
  isAdminView = false,
  selectedMasterId = "all",
  adminMastersList,
  onMasterChange,
}: CalendarToolbarProps) {
  const { t } = useTranslation()
  const [showMobileControls, setShowMobileControls] = useState(false)

  if (isMobile) {
    return (
      <div className="min-h-[4rem] py-2 border-b border-border/60 px-3 shrink-0 z-10 transition-colors shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("prev")} className="hover:bg-muted"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("next")} className="hover:bg-muted"><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => navigate("today")} className="bg-transparent border-border hover:bg-muted shrink-0">{t('admin.calendar.todayBtn')}</Button>
          </div>

          <h2 className="text-base font-semibold truncate min-w-0 flex-1 text-center px-1">{headerDisplay}</h2>

          <div className="flex items-center gap-1">
            <div className={`h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin transition-opacity ${loading ? 'opacity-100' : 'opacity-0'}`}></div>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('admin.calendar.mobileControlsAria')}
              onClick={() => setShowMobileControls(true)}
              className="bg-transparent border-border hover:bg-muted shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex rounded-full border border-border bg-transparent p-0.5 gap-0.5 mt-2 w-full">
          {(["Month", "Week", "Day"] as ViewType[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors rounded-full ${
                view === v
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {v === "Month" ? t('admin.calendar.monthView') : v === "Week" ? t('admin.calendar.weekView') : t('admin.calendar.dayView')}
            </button>
          ))}
        </div>

        <Sheet open={showMobileControls} onOpenChange={setShowMobileControls}>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t('admin.calendar.mobileControlsTitle')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4 flex flex-col gap-4">
              <Select value={String(step)} onValueChange={(v) => setStep(Number(v ?? step))} disabled={view === "Month"}>
                <SelectTrigger className="h-auto w-full bg-transparent hover:bg-muted px-3 py-2 text-sm font-medium shadow-sm border border-border">
                  <SelectValue>{(v: string) => t('admin.calendar.minutesOption', { count: Number(v) })}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 30, 60].map(s => (
                    <SelectItem key={s} value={String(s)}><SelectItemText>{t('admin.calendar.minutesOption', { count: s })}</SelectItemText></SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isAdminView && adminMastersList && onMasterChange && (
                <div className="pb-2 border-b border-border/50">
                  <MasterSelectDropdown
                    selectedMasterId={selectedMasterId}
                    adminMastersList={adminMastersList}
                    onMasterChange={onMasterChange}
                  />
                </div>
              )}

              <Button
                variant={isEditMode ? "default" : "outline"}
                onClick={() => setIsEditMode(!isEditMode)}
                disabled={isAdminView && selectedMasterId === "all"}
                className={`w-full gap-2 justify-center transition-all ${isEditMode ? 'bg-primary text-primary-foreground shadow shadow-primary/20' : 'bg-transparent border-border hover:bg-muted'}`}
              >
                {isEditMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                {isEditMode ? t('admin.calendar.doneEditing') : t('admin.calendar.editSchedule')}
              </Button>

              <Button variant="outline" onClick={() => setShowBulkModal(true)} className="w-full gap-2 justify-center bg-transparent border-border hover:bg-muted">
                <Calendar className="w-4 h-4" />
                {t('admin.calendar.bulkSettings')}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  return (
    <div className="min-h-[4rem] py-2 border-b border-border/60 px-4 shrink-0 z-10 transition-colors shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("today")} className="bg-transparent border-border hover:bg-muted">{t('admin.calendar.todayBtn')} <span className="opacity-70 ml-1">· {todayDisplay}</span></Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigate("prev")} className="hover:bg-muted"><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("next")} className="hover:bg-muted"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <h2 className="text-xl font-semibold min-w-[150px]">{headerDisplay}</h2>

          <div className={`h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin ml-2 transition-opacity ${loading ? 'opacity-100' : 'opacity-0'}`}></div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="flex rounded-full border border-border bg-transparent p-0.5 gap-0.5">
            {(["Month", "Week", "Day"] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-full ${
                  view === v
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="inline-block min-w-[8ch] text-center">
                  {v === "Month" ? t('admin.calendar.monthView') : v === "Week" ? t('admin.calendar.weekView') : t('admin.calendar.dayView')}
                </span>
              </button>
            ))}
          </div>

          {isAdminView && adminMastersList && onMasterChange && (
            <MasterSelectDropdown
              selectedMasterId={selectedMasterId}
              adminMastersList={adminMastersList}
              onMasterChange={onMasterChange}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 mt-3">
        <Select value={String(step)} onValueChange={(v) => setStep(Number(v ?? step))} disabled={view === "Month"}>
          <SelectTrigger className="h-auto w-auto bg-transparent hover:bg-muted px-3 py-1.5 text-sm font-medium shadow-sm">
            <SelectValue>{(v: string) => t('admin.calendar.minutesOption', { count: Number(v) })}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[5, 10, 15, 30, 60].map(s => (
              <SelectItem key={s} value={String(s)}><SelectItemText>{t('admin.calendar.minutesOption', { count: s })}</SelectItemText></SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-border" />

        {/* Always show Bulk Settings and Edit Tools, Bulk handles 'all' context naturally */}
        <Button
          variant={isEditMode ? "default" : "outline"}
          size="sm"
          onClick={() => setIsEditMode(!isEditMode)}
          disabled={isAdminView && selectedMasterId === "all"} // Disable inline edit for 'all' mode
          className={`gap-2 transition-all ${isEditMode ? 'bg-primary text-primary-foreground shadow shadow-primary/20' : 'bg-transparent border-border hover:bg-muted'}`}
        >
          {isEditMode ? <Save className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          <span className="hidden sm:inline-block min-w-[24ch] text-center">{isEditMode ? t('admin.calendar.doneEditing') : t('admin.calendar.editSchedule')}</span>
        </Button>

        <Button variant="outline" size="sm" onClick={() => setShowBulkModal(true)} className="gap-2 shrink-0 bg-transparent border-border hover:bg-muted">
          <Calendar className="w-4 h-4" />
          <span className="hidden sm:inline-block min-w-[29ch] text-center">{t('admin.calendar.bulkSettings')}</span>
        </Button>
      </div>
    </div>
  )
}

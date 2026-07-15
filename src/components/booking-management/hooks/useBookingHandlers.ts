import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProcedureOption, SlotSelection } from '../types'
import { clientLog } from '@/lib/client-logger'

interface UseBookingHandlersProps {
  state: any
  actions: any
  mutations: {
    searchMutation: any
    updateProcedureMutation: any
    updateMutation: any
    updateTimeMutation: any
    cancelMutation: any
    checkExtensionAvailability: () => Promise<void>
    resetCalendarState: () => void
  }
  canSearch: boolean
  siteKey?: string
  turnstileSession: any
  deriveProcedureForBooking: (booking: any) => ProcedureOption | null
  selectedSlot?: SlotSelection | null
  onSlotSelected?: (slot: SlotSelection) => void
}

export function useBookingHandlers({
  state,
  actions,
  mutations,
  canSearch,
  siteKey,
  turnstileSession,
  deriveProcedureForBooking,
  selectedSlot,
  onSlotSelected,
}: UseBookingHandlersProps) {
  const { t } = useTranslation()
  const {
    searchMutation,
    updateProcedureMutation,
    updateMutation,
    updateTimeMutation,
    cancelMutation,
    checkExtensionAvailability,
    resetCalendarState,
  } = mutations

  // Search handler
  const handleSearch = useCallback(() => {
    if (!canSearch) {
      if (!siteKey) {
        actions.setFormError(t('management.searchFormIncomplete'))
      } else if (!turnstileSession.turnstileToken) {
        actions.setFormError(t('management.turnstileRequired'))
      } else {
        actions.setFormError(t('management.searchFormIncomplete'))
      }
      return
    }
    const token = siteKey ? turnstileSession.turnstileToken ?? undefined : undefined
    if (siteKey && !token) {
      actions.setFormError(t('management.turnstileRequired'))
      return
    }
    if (token) {
      turnstileSession.setTurnstileToken(token)
    }
    searchMutation.mutate({ turnstileToken: token })
  }, [canSearch, searchMutation, siteKey, turnstileSession, actions, t])

  // Toggle panel
  const handleToggle = useCallback((onPanelOpenChange?: (isOpen: boolean) => void) => {
    if (state.isOpen) {
      // При закрытии панели - сбрасываем календарь если была активна сессия изменения времени
      if (state.timeChangeSession || state.wasEditing) {
        clientLog.info('🔙 Closing BookingManagement panel - resetting calendar state')
        resetCalendarState()
      }
      // Полностью удаляем Turnstile при закрытии панели, чтобы корректно пересоздать при следующем открытии
      if (siteKey) {
        turnstileSession.removeWidget()
      }
      actions.closePanel()
      onPanelOpenChange?.(false)
    } else {
      actions.togglePanel()
      // Гарантируем рендер Turnstile при открытии панели
      if (siteKey) {
        turnstileSession.ensureWidget()
      }
      if (siteKey && turnstileSession.turnstileToken) {
        actions.setFormError(null)
      }
      onPanelOpenChange?.(true)
    }
  }, [state.isOpen, state.timeChangeSession, state.wasEditing, siteKey, turnstileSession, actions, resetCalendarState])

  // Booking selection handlers
  const handleSelectBooking = useCallback((booking: any) => {
    actions.selectBooking(booking)
  }, [actions])

  const handleChangeBooking = useCallback((booking: any) => {
    if (!booking) return
    actions.selectBooking(booking)
    actions.setState('edit-selection')
  }, [actions])

  // Procedure change handlers
  const handleSelectChangeProcedure = useCallback(() => {
    clientLog.info('💆‍♀️ Starting procedure change flow')
    actions.setActionError(null)
    actions.selectProcedure(null)
    actions.clearExtensionCheck() // Очищаем предыдущую проверку
    actions.setState('edit-procedure')
  }, [actions])

  const handleSelectProcedure = useCallback((proc: ProcedureOption | null) => {
    clientLog.info('🧭 Procedure selected:', proc?.name_pl)
    actions.selectProcedure(proc)
  }, [actions])

  const handleConfirmSameTime = useCallback(() => {
    clientLog.info('✅ Confirming procedure change on same time - executing immediately')
    clientLog.info('📋 Selected procedure:', state.selectedProcedure)
    clientLog.info('📋 Selected booking:', state.selectedBooking)
    if (!state.selectedProcedure) {
      clientLog.warn('⚠️ No procedure selected!')
      actions.setActionError(t('management.selectProcedure'))
      return
    }
    if (!state.selectedBooking) {
      clientLog.error('❌ No selected booking!')
      return
    }
    actions.setActionError(null)
    clientLog.info('🚀 Executing procedure change immediately')
    // Сразу вызываем мутацию без промежуточного состояния
    updateProcedureMutation.mutate()
  }, [state.selectedProcedure, state.selectedBooking, actions, updateProcedureMutation, t])

  // Time change handlers
  const handleSelectChangeTime = useCallback(() => {
    clientLog.info('⏰ Starting direct time change for booking:', state.selectedBooking?.eventId)
    if (!state.selectedBooking) return
    
    // Создаем сессию изменения времени
    const procedure = deriveProcedureForBooking(state.selectedBooking)
    if (!procedure) {
      clientLog.error('❌ Cannot derive procedure for booking')
      return
    }
    const session = {
      originalBooking: state.selectedBooking,
      selectedProcedure: procedure,
      newSlot: null,
    }
    
    // Активируем Turnstile для изменения времени
    if (siteKey && turnstileSession.turnstileToken) {
      actions.setActionError(null)
    }
    
    clientLog.info('💾 Creating time change session and going direct to comparison:', session.originalBooking.procedureName)
    actions.startTimeChange(session)
    actions.setState('direct-time-change')
  }, [state.selectedBooking, deriveProcedureForBooking, siteKey, turnstileSession, actions])

  const handleRequestNewTime = useCallback(() => {
    clientLog.info('📅 Requesting new time for procedure change:', state.selectedProcedure?.name_pl)
    if (!state.selectedBooking || !state.selectedProcedure) {
      clientLog.error('❌ No booking or procedure selected!')
      return
    }
    
    // Очищаем проверку доступности если была
    actions.clearExtensionCheck()
    
    // Создаем сессию изменения времени с НОВОЙ процедурой
    const session = {
      originalBooking: state.selectedBooking,
      selectedProcedure: state.selectedProcedure, // НОВАЯ процедура!
      newSlot: null,
    }
    
    clientLog.info('💾 Creating time change session for procedure change:', {
      oldProcedure: state.selectedBooking.procedureName,
      newProcedure: state.selectedProcedure.name_pl,
    })
    
    actions.startTimeChange(session)
    actions.setState('direct-time-change')
  }, [state.selectedBooking, state.selectedProcedure, actions])

  const handleCheckAvailability = useCallback(async () => {
    await checkExtensionAvailability()
  }, [checkExtensionAvailability])

  const handleSelectAlternativeSlot = useCallback((slot: SlotSelection) => {
    clientLog.info('📍 Selected alternative slot:', slot)
    actions.selectAlternativeSlot(slot)
  }, [actions])

  const handleConfirmAlternativeSlot = useCallback(() => {
    if (!state.selectedBooking || !state.selectedProcedure) {
      clientLog.error('❌ No booking or procedure selected!')
      return
    }
    
    // Используем выбранный альтернативный слот или предложенный системой
    const slotToUse = state.selectedAlternativeSlot || 
      (state.extensionCheckResult?.suggestedStartISO && state.extensionCheckResult?.suggestedEndISO
        ? {
            startISO: state.extensionCheckResult.suggestedStartISO,
            endISO: state.extensionCheckResult.suggestedEndISO,
          }
        : null)
    
    if (!slotToUse) {
      clientLog.error('❌ No alternative slot available!')
      return
    }
    
    clientLog.info('✅ Confirming alternative slot:', slotToUse)
    
    // Используем updateMutation для комбинированного изменения (процедура + время)
    updateMutation.mutate({
      newProcedureId: state.selectedProcedure.id,
      newSlot: slotToUse,
    })
  }, [state.selectedBooking, state.selectedProcedure, state.selectedAlternativeSlot, state.extensionCheckResult, updateMutation])

  const handleConfirmSlot = useCallback(() => {
    clientLog.info('🎯 Confirming slot for time change:', selectedSlot)
    if (!selectedSlot || !state.timeChangeSession) {
      clientLog.error('❌ No selectedSlot or timeChangeSession available!')
      return
    }
    
    // Сохраняем выбранный слот в сессию
    clientLog.info('💾 Saving slot to time change session')
    actions.setTimeChangeSlot(selectedSlot)
    
    if (onSlotSelected) {
      onSlotSelected(selectedSlot)
    }
  }, [selectedSlot, state.timeChangeSession, actions, onSlotSelected])

  const handleConfirmTimeChange = useCallback(() => {
    clientLog.info('🔄 Confirming time change from session:', state.timeChangeSession?.originalBooking.eventId)
    
    if (!state.timeChangeSession) {
      clientLog.error('❌ No time change session!')
      return
    }
    
    // Если есть selectedSlot, но нет newSlot в сессии - сохраняем
    if (selectedSlot && !state.timeChangeSession.newSlot) {
      clientLog.info('💾 First saving selectedSlot to session:', selectedSlot)
      actions.setTimeChangeSlot(selectedSlot)
      if (onSlotSelected) {
        onSlotSelected(selectedSlot)
      }
    }
    
    // Проверяем что есть слот для изменения  
    const slotToUse = state.timeChangeSession.newSlot || selectedSlot
    if (!slotToUse) {
      clientLog.error('❌ No slot available for time change!')
      return
    }
    
    // Проверяем, меняется ли процедура
    const isProcedureChange = state.timeChangeSession.selectedProcedure.name_pl !== state.timeChangeSession.originalBooking.procedureName
    
    if (isProcedureChange) {
      // Комбинированное изменение: процедура + время
      clientLog.info('📤 Executing combined procedure+time change...')
      updateMutation.mutate({
        newProcedureId: state.timeChangeSession.selectedProcedure.id,
        newSlot: slotToUse,
      })
    } else {
      // Только изменение времени
      clientLog.info('📤 Executing time change only...')
      updateTimeMutation.mutate()
    }
  }, [state.timeChangeSession, selectedSlot, actions, onSlotSelected, updateMutation, updateTimeMutation])

  const handleConfirmTimeChangeBack = useCallback(() => {
    // Проверяем, это была смена процедуры или просто время
    const isProcedureChange = state.timeChangeSession && 
      state.timeChangeSession.selectedProcedure.name_pl !== state.timeChangeSession.originalBooking.procedureName
    
    clientLog.info('🔙 User canceled time change - resetting calendar', {
      isProcedureChange,
      goingTo: isProcedureChange ? 'edit-procedure' : 'edit-selection'
    })
    
    resetCalendarState()
    
    if (isProcedureChange) {
      // При возврате к смене процедуры - сохраняем selectedProcedure, но очищаем session
      actions.clearTimeChange()
      actions.setState('edit-procedure')
    } else {
      // При возврате от простой смены времени - очищаем всё
      if (siteKey) {
        turnstileSession.resetWidget()
      }
      actions.setState('edit-selection')
    }
    
    actions.setActionError(null)
  }, [state.timeChangeSession, siteKey, turnstileSession, actions, resetCalendarState])

  // Navigation handlers
  const handleEditSelectionBack = useCallback(() => {
    actions.clearExtensionCheck() // Очищаем проверку при возврате
    actions.setState('results')
    actions.setActionError(null)
  }, [actions])

  const handleBackToEditSelection = useCallback(() => {
    clientLog.info('🔙 Going back to edit selection - clearing time change session and resetting calendar')
    resetCalendarState()
    actions.clearTimeChange()
    actions.setState('edit-selection')
    actions.setActionError(null)
  }, [actions, resetCalendarState])

  const handleBackToResults = useCallback(() => {      
    actions.clearTimeChange() // Очищаем сессию при возврате
    actions.selectProcedure(null) // Очищаем выбранную процедуру
    actions.setState('results')
    
    // Сбрасываем Turnstile для чистого старта
    if (siteKey) {
      turnstileSession.resetWidget()
    }
    
    // Обновляем поиск при возврате к результатам
    clientLog.info('🔄 Refreshing search after successful change')
    const token = siteKey ? (turnstileSession.turnstileToken ?? undefined) : undefined
    if (token) turnstileSession.setTurnstileToken(token)
    searchMutation.mutate({ turnstileToken: token })
  }, [actions, siteKey, turnstileSession, searchMutation])

  const handleBackToSearch = useCallback(() => {
    actions.setState('search')
    actions.setActionError(null)
    actions.selectProcedure(null)
    actions.setPendingSlot(null)
    actions.resetForm()
  }, [actions])

  const handleStartNewSearch = useCallback(() => {
    actions.resetForm()
    actions.setState('search')
  }, [actions])

  // Retry handlers
  const handleRetryTimeChange = useCallback(() => {
    // Возвращаемся к выбору времени для повторной попытки и сбрасываем календарь
    clientLog.info('🔄 User retrying time change after error - resetting calendar')
    resetCalendarState()
    if (state.timeChangeSession) {
      actions.setState('edit-datetime')
    } else {
      actions.setState('results')
    }
  }, [state.timeChangeSession, actions, resetCalendarState])

  const handleRetryCancel = useCallback(() => {
    // Вернуться к подтверждению отмены, чтобы попробовать снова
    actions.setActionError(null)
    actions.setState('confirm-cancel')
  }, [actions])

  // Cancel handlers
  const handleConfirmCancel = useCallback(() => {
    cancelMutation.mutate()
  }, [cancelMutation])

  // Contact master handlers
  const handleContactMaster = useCallback(() => {
    clientLog.info('Opening contact master panel')
    actions.setState('contact-master')
  }, [actions])
  
  const handleContactMasterSuccess = useCallback(() => {
    clientLog.info('Contact master success')
    actions.setState('contact-master-success')
  }, [actions])
  
  const handleContactMasterBack = useCallback(() => {
    clientLog.info('Going back from contact master')
    actions.setState('results')
  }, [actions])
  
  const handleContactMasterClose = useCallback(() => {
    clientLog.info('Closing contact master success')
    actions.setState('search')
    actions.resetForm()
  }, [actions])

  return {
    handleSearch,
    handleToggle,
    handleSelectBooking,
    handleChangeBooking,
    handleSelectChangeProcedure,
    handleSelectProcedure,
    handleConfirmSameTime,
    handleSelectChangeTime,
    handleRequestNewTime,
    handleCheckAvailability,
    handleSelectAlternativeSlot,
    handleConfirmAlternativeSlot,
    handleConfirmSlot,
    handleConfirmTimeChange,
    handleConfirmTimeChangeBack,
    handleEditSelectionBack,
    handleBackToEditSelection,
    handleBackToResults,
    handleBackToSearch,
    handleStartNewSearch,
    handleRetryTimeChange,
    handleRetryCancel,
    handleConfirmCancel,
    handleContactMaster,
    handleContactMasterSuccess,
    handleContactMasterBack,
    handleContactMasterClose,
  }
}

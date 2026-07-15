import { useMutation } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  searchBookings,
  updateBookingTime,
  updateBooking,
  updateBookingProcedure,
  cancelBooking,
  checkProcedureExtension,
  ApiError,
} from '../api/bookingManagementApi'
import type { ProcedureOption, SlotSelection } from '../types'
import { clientLog } from '@/lib/client-logger'
import { apiErrorKey } from '@/lib/errors/apiErrorKey'

interface MutationError {
  message: string
}

interface UseBookingMutationsProps {
  state: any
  actions: any
  procedures: ProcedureOption[]
  turnstileToken?: string | null
  onDateReset?: () => void
  onCalendarModeChange?: (mode: 'booking' | 'editing') => void
  onProcedureChange?: (procedureId: string | undefined) => void
  masterId?: string
}

export function useBookingMutations({
  state,
  actions,
  procedures,
  turnstileToken,
  onDateReset,
  onCalendarModeChange,
  onProcedureChange,
  masterId,
}: UseBookingMutationsProps) {
  const { t } = useTranslation()

  // Универсальная функция для сброса состояния календаря
  const resetCalendarState = useCallback(() => {
    clientLog.info('🔄 Resetting calendar state to initial (no procedure, no date, no slot)')
    actions.setPendingSlot(null)
    onDateReset?.() // Сбрасываем выбранную дату
    onCalendarModeChange?.('booking') // Возвращаем в режим бронирования
    onProcedureChange?.(undefined) // Сбрасываем процедуру - календарь станет неактивным
  }, [onDateReset, onCalendarModeChange, onProcedureChange, actions])

  // Search mutation
  const searchMutation = useMutation<typeof state.results, MutationError, { turnstileToken?: string; dateRange?: { start: string; end: string } }>({
    mutationFn: async ({ turnstileToken: providedToken, dateRange } = {}) => {
      return searchBookings(state.form, procedures, providedToken, dateRange, masterId)
    },
    onMutate: () => {
      actions.startSearch()
    },
    onSuccess: (results) => {
      actions.handleSearchSuccess(results)
    },
    onError: (error) => {
      const code = (error as ApiError).code
      actions.handleSearchError(code ? t(apiErrorKey(code)) : t('management.searchFailed'))
    },
  })

  // Мутация для изменения процедуры (M1 Step 2) - простая без валидации
  const updateProcedureMutation = useMutation<void, MutationError, void>({
    mutationFn: async () => {
      if (!state.selectedBooking) {
        throw new ApiError('Brak wybranej rezerwacji.')
      }
      if (!state.selectedProcedure) {
        throw new ApiError('Wybierz procedurę.')
      }
      clientLog.info('🔄 Updating procedure:', state.selectedProcedure.name_pl)
      // NO TURNSTILE - user already verified during search (like updateBookingTime)
      await updateBookingProcedure(state.selectedBooking, state.selectedProcedure.id, masterId)
    },
    onSuccess: () => {
      clientLog.info('✅ Procedure updated successfully')
      actions.setActionError(null)
      actions.clearExtensionCheck() // Очищаем проверку после успешного сохранения
      
      // Сбрасываем календарь к начальному состоянию
      resetCalendarState()
      
      actions.setState('procedure-change-success')
    },
    onError: (error) => {
      clientLog.error('❌ Procedure update failed:', error.message)
      actions.setActionError(t(apiErrorKey((error as ApiError).code)))

      // Сбрасываем календарь при ошибке тоже
      resetCalendarState()

      actions.setState('procedure-change-error')
    },
  })

  // Update mutation (для комбинированных изменений - процедура + время)
  const updateMutation = useMutation<
    { startTime?: string; endTime?: string; procedure?: string }, 
    MutationError, 
    { newProcedureId?: string; newSlot?: SlotSelection }
  >({
    mutationFn: async (changes) => {
      if (!state.selectedBooking) {
        throw new ApiError('Brak wybranej rezerwacji.')
      }
      const token = turnstileToken ?? undefined
      return await updateBooking(state.selectedBooking, changes, token, masterId)
    },
    onSuccess: (data) => {
      clientLog.info('✅ Combined procedure+time update successful', data)
      actions.setActionError(null)
      actions.clearExtensionCheck()
      
      // Update booking time in state if it changed
      if (data.startTime && data.endTime && state.selectedBooking) {
        clientLog.info('🔄 Updating booking time in state:', {
          old: { start: state.selectedBooking.startTime, end: state.selectedBooking.endTime },
          new: { start: data.startTime, end: data.endTime }
        })
        actions.updateBookingTime({
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime)
        })
      }
      
      // Сбрасываем календарь к начальному состоянию
      resetCalendarState()
      
      // Показываем панель успеха изменения процедуры (не просто results)
      actions.setState('procedure-change-success')
    },
    onError: (error) => {
      clientLog.error('❌ Combined update failed:', error.message)
      actions.setActionError(t(apiErrorKey((error as ApiError).code)))

      // Сбрасываем календарь при ошибке тоже
      resetCalendarState()

      actions.setState('procedure-change-error')
    },
  })

  // Простая мутация для изменения времени - чистая архитектура
  // NO TURNSTILE - user already verified during search
  const updateTimeMutation = useMutation<void, MutationError, void>({
    mutationFn: async () => {
      if (!state.timeChangeSession?.newSlot) {
        throw new ApiError('Brak wybranego nowego terminu.')
      }
      
      clientLog.info('🚀 Starting simple time update (no Turnstile):', state.timeChangeSession.originalBooking.eventId)
      
      await updateBookingTime(
        state.timeChangeSession.originalBooking,
        state.timeChangeSession.newSlot,
        masterId,
      )
    },
    onSuccess: () => {
      clientLog.info('🎉 Time change successful - showing success state')
      actions.setActionError(null)
      
      // Сбрасываем состояние календаря и показываем панель успеха
      resetCalendarState()
      actions.setState('time-change-success')
      
      clientLog.info('✅ State changed to time-change-success')
      
      // НЕ обновляем поиск сразу - пусть пользователь увидит success панель
      // Обновим когда он нажмет "Powrót do wyników"
    },
    onError: (error) => {
      clientLog.error('❌ Time change failed:', error.message)
      actions.setActionError(t(apiErrorKey((error as ApiError).code)))

      // Сбрасываем состояние календаря при ошибке тоже
      resetCalendarState()
      actions.setState('time-change-error')

      clientLog.info('❌ State changed to time-change-error')
    },
  })

  // Cancel mutation
  const cancelMutation = useMutation<void, MutationError, void>({
    mutationFn: async () => {
      if (!state.selectedBooking) {
        throw new ApiError('Brak wybranej rezerwacji.')
      }
      await cancelBooking(state.selectedBooking, masterId)
    },
    onSuccess: () => {
      actions.setActionError(null)
      // Pokaż zielоную панель успеха anulowania; не обновляем список сразу
      actions.setState('cancel-success')
    },
    onError: (error) => {
      // Переходим на красную панель ошибки с понятным сообщением
      actions.setActionError(t(apiErrorKey((error as ApiError).code)))
      actions.setState('cancel-error')
    },
  })

  // Helper для проверки доступности расширения процедуры
  const checkExtensionAvailability = useCallback(async () => {
    if (!state.selectedBooking || !state.selectedProcedure) {
      clientLog.error('❌ No booking or procedure selected!')
      return
    }
    
    clientLog.info('🔍 Checking extension availability for:', state.selectedProcedure.name_pl)
    
    // Устанавливаем статус проверки
    actions.setExtensionCheckStatus('checking')
    actions.setActionError(null)
    
    try {
      clientLog.info('🔍 Calling checkProcedureExtension (no Turnstile):', {
        eventId: state.selectedBooking.eventId,
        procedureId: state.selectedProcedure.id,
        currentStart: state.selectedBooking.startTime.toISOString(),
        currentEnd: state.selectedBooking.endTime.toISOString(),
      })
      
      const response = await checkProcedureExtension(
        state.selectedBooking,
        state.selectedProcedure.id,
        masterId,
      )
      
      clientLog.info('✅ Extension check result:', response.result.status, response.result)
      
      // Сохраняем результат проверки
      actions.setExtensionCheckResult(response.result)
      
    } catch (error) {
      clientLog.error('❌ Extension check failed:', error)
      actions.setActionError(t(apiErrorKey(error instanceof ApiError ? error.code : undefined)))
      actions.setExtensionCheckStatus(null)
    }
  }, [state.selectedBooking, state.selectedProcedure, actions, t])

  return {
    searchMutation,
    updateProcedureMutation,
    updateMutation,
    updateTimeMutation,
    cancelMutation,
    checkExtensionAvailability,
    resetCalendarState,
  }
}

# Адаптация BookingManagement под Prisma/SQLite

## Резюме проблемы

Компонент `BookingManagement` (`src/components/booking-management/`) — полнофункциональная панель управления записями клиента. Она позволяет:
- Найти свои записи по имени + телефону
- Изменить время записи (с умным алгоритмом сдвига)
- Изменить процедуру (с проверкой доступности)
- Отменить запись
- Связаться с мастером

**Проблема**: Фронтенд полностью готов и работоспособен, но он обращается к **6 API-эндпоинтам, которых НЕ СУЩЕСТВУЕТ** в текущем проекте. Эти эндпоинты были частью старой архитектуры Google Calendar и были удалены при миграции на Prisma+SQLite. Сами компоненты UI не нуждаются в изменениях — нужно только создать backend API.

---

## Текущая архитектура (Frontend → ?)

### Файловая структура (без изменений)

```
src/components/booking-management/
├── BookingManagement.tsx          — главный компонент (304 строки)
├── PanelRenderer.tsx              — роутер панелей по state (443 строки)
├── types.ts                       — типы: ManagementState, BookingResult, ProcedureOption, etc.
├── index.ts                       — re-export
├── api/
│   └── bookingManagementApi.ts    — API-клиент (434 строки) ⚠️ КЛЮЧЕВОЙ ФАЙЛ
├── hooks/
│   ├── useBookingHandlers.ts      — обработчики событий (471 строка)
│   ├── useBookingMutations.ts     — мутации react-query (255 строк)
│   └── useTurnstileSession.ts     — Turnstile CAPTCHA (160 строк)
├── state/
│   └── useBookingManagementState.ts — reducer + actions (373 строки)
└── [18 панелей UI]                — SearchPanel, ResultsPanel, EditSelectionPanel, etc.
```

### Конечный автомат (State Machine)

> ⚠️ **Состояние `extended_search` удаляется** — оно больше не нужно, т.к. единый SQL-запрос сразу отдаёт все предстоящие записи клиента.

```
[*] --> search
search --> loading : handleSearch
loading --> results : найдены записи
loading --> not_found : записей нет
not_found --> contact_master : связаться  (убрать кнопку "расширить поиск")
results --> edit_selection : нажать "Изменить" (только canModify=true)
results --> confirm_cancel : нажать "Отменить" (только canModify=true)
results --> contact_master : связаться с мастером
edit_selection --> edit_procedure : сменить процедуру
edit_selection --> direct_time_change : сменить время
edit_procedure --> direct_time_change : нужно новое время
direct_time_change --> confirm_time_change : выбран слот
confirm_time_change --> time_change_success : OK
confirm_time_change --> time_change_error : ошибка
confirm_cancel --> cancel_success : OK
confirm_cancel --> cancel_error : ошибка
edit_procedure --> procedure_change_success : OK (same time)
edit_procedure --> procedure_change_error : ошибка
contact_master --> contact_master_success : отправлено
```

---

## Логика 24-часового ограничения (canModify / canCancel)

**Поведение в UI** (файл `ResultsPanel.tsx`, строки 96-135):

Когда `canModify = false` (до записи осталось менее 24 часов):
1. На карточке записи показывается **предупреждающий текст** жёлтого цвета: `lessThan24h` — "Менее 24 часов до визита"
2. Кнопки **"Изменить" и "Отменить" НЕ показываются вообще** (условие `isSelected && booking.canModify` — false)
3. Вместо кнопок показывается текст `cannotModifyOnline` — "Nie można zmienić online. Skontaktuj się z masterem" (свяжитесь с мастером)
4. Кнопка "Связаться с мастером" (`onContactMaster`) всегда доступна внизу панели результатов

**Вычисление `canModify`/`canCancel` на бэкенде**:
```
canModify = canCancel = (appointmentDateTime - now) > 24 часа
```
Оба флага всегда совпадают — если нельзя изменить, то и отменить нельзя. Клиент видит надпись и должен связаться с мастером напрямую через отдельную форму.

---

## 6 отсутствующих API-эндпоинтов

Фронтенд в `bookingManagementApi.ts` вызывает следующие URL:

| # | URL | Метод | Назначение | Статус |
|---|-----|-------|-----------|--------|
| 1 | `/api/bookings/all` | GET | Поиск записей клиента | ❌ Не существует |
| 2 | `/api/bookings/cancel` | POST | Отмена записи | ❌ Не существует |
| 3 | `/api/bookings/update-time` | POST | Изменение времени | ❌ Не существует |
| 4 | `/api/bookings/update-procedure` | POST | Изменение процедуры | ❌ Не существует |
| 5 | `/api/bookings/{id}` | PATCH | Комбинированное изменение | ❌ Не существует |
| 6 | `/api/bookings/{id}/check-extension` | POST | Проверка сдвига | ❌ Не существует |

---

## Детальное описание каждого эндпоинта

### 1. `GET /api/bookings/all` — Поиск записей

**Вызывается из**: `searchBookings()` в `bookingManagementApi.ts:84-191` *(будет упрощён в Шаге 7)*

**Новая логика (Вариант B — серверная фильтрация)**:
- Фронтенд передаёт `phone` + `name` как query params
- Сервер фильтрует по ним в SQL — клиент никогда не видит чужие записи
- Возвращаются только **предстоящие** записи (`date >= today`)
- Диапазон: от сегодня до бесконечности (хоть 10 лет) — SQL справляется без проблем

**Параметры запроса**: `?masterId=xxx&phone=+48123456789&name=Наталія`

**Ожидаемый ответ**:
```json
{
  "bookings": [
    {
      "eventId": "appointment-id",
      "firstName": "Наталія",
      "lastName": "Коваленко",
      "phone": "+48123456789",
      "email": "test@test.com",
      "procedureName": "Manicure",
      "startTime": "2026-04-10T10:00:00+02:00",
      "endTime": "2026-04-10T11:00:00+02:00",
      "price": 120,
      "canModify": true,
      "canCancel": true
    }
  ],
  "count": 1,
  "cached": false
}
```

**`canModify` / `canCancel` логика**:
- Построить `appointmentDateTime` из `date` + `startTime` в timezone Europe/Warsaw
- `canModify = canCancel = (appointmentDateTime - now) > 24 часа`
- Оба флага ВСЕГДА одинаковы — если <24ч, то ни изменить, ни отменить нельзя, клиенту показывается текст "свяжитесь с мастером"

---

### 2. `POST /api/bookings/cancel` — Отмена записи

**Вызывается из**: `cancelBooking()` в `bookingManagementApi.ts:385-433`

**Тело запроса**:
```json
{
  "eventId": "appointment-id",
  "firstName": "Наталія",
  "phone": "+48123456789",
  "email": "",
  "masterId": "master-user-id"
}
```

**Логика**:
1. Найти Appointment по `eventId` (= `id` в Prisma)
2. Верифицировать что клиент совпадает (по phone — последние 9 цифр)
3. Проверить что до записи >24 часа (дополнительная серверная валидация)
4. Установить `status = "CANCELLED"`

**Коды ошибок**: `BOOKING_NOT_FOUND`, `VERIFICATION_FAILED`, `TOO_LATE_TO_CANCEL`, `RATE_LIMITED`

> Примечание: кнопка отмены скрыта в UI если `canModify=false`, но сервер ТОЖЕ должен проверять 24ч как дополнительный уровень защиты.

---

### 3. `POST /api/bookings/update-time` — Изменение времени

**Вызывается из**: `updateBookingTime()` в `bookingManagementApi.ts:339-383`

**Тело запроса**:
```json
{
  "eventId": "appointment-id",
  "procedureName": "Manicure",
  "firstName": "Наталія",
  "lastName": "Коваленко",
  "phone": "+48123456789",
  "email": "",
  "price": 120,
  "newStartISO": "2026-04-11T14:00:00+02:00",
  "newEndISO": "2026-04-11T15:00:00+02:00",
  "masterId": "master-user-id"
}
```

**Логика**:
1. Найти Appointment по `eventId`
2. Верифицировать клиента
3. Проверить что новый слот свободен (нет конфликтов)
4. Обновить `date`, `startTime`, `endTime`

---

### 4. `POST /api/bookings/update-procedure` — Изменение процедуры

**Вызывается из**: `updateBookingProcedure()` в `bookingManagementApi.ts:294-335`

**Тело запроса**:
```json
{
  "eventId": "appointment-id",
  "firstName": "Наталія",
  "lastName": "Коваленко",
  "phone": "+48123456789",
  "email": "",
  "currentStartISO": "2026-04-10T10:00:00+02:00",
  "newProcedureId": "service-id",
  "masterId": "master-user-id"
}
```

**Логика**:
1. Найти Appointment и Service (новый)
2. Верифицировать клиента
3. Пересчитать `endTime`:
   - Парсить `startTime` из существующей записи
   - `newEndMinutes = startMinutes + newService.duration`
   - Форматировать как "HH:mm"
4. Обновить: `appointment.update({ serviceId: newProcedureId, endTime: newEndTime })`

---

### 5. `PATCH /api/bookings/{id}` — Комбинированное изменение (процедура + время)

**Вызывается из**: `updateBooking()` в `bookingManagementApi.ts:193-235`

**Тело запроса**:
```json
{
  "newProcedureId": "service-id",
  "newStartISO": "2026-04-11T14:00:00+02:00",
  "newEndISO": "2026-04-11T15:30:00+02:00",
  "masterId": "master-user-id"
}
```

**Ответ**: `{ "changes": { "startTime": "...", "endTime": "...", "procedure": "..." } }`

**Логика**: Комбинация update-time + update-procedure в одном запросе.

---

### 6. `POST /api/bookings/{id}/check-extension` — Умный алгоритм сдвига

**Вызывается из**: `checkProcedureExtension()` в `bookingManagementApi.ts:239-291`

> ⚠️ **ВАЖНО**: Это КЛЮЧЕВОЙ алгоритм — "умный сдвиг". Когда клиент меняет процедуру на более длинную, система проверяет можно ли вместить новую длительность.

**Тело запроса**:
```json
{
  "eventId": "appointment-id",
  "currentStartISO": "2026-04-10T10:00:00+02:00",
  "currentEndISO": "2026-04-10T11:00:00+02:00",
  "newProcedureId": "longer-service-id",
  "masterId": "master-user-id"
}
```

**Ответ — 3 сценария**:

#### Сценарий A: `can_extend` — время после записи свободно
```json
{
  "result": {
    "status": "can_extend",
    "message": "Czas po aktualnym terminie jest wolny. Można wydłużyć."
  },
  "currentBooking": { "startISO": "...", "endISO": "..." },
  "newProcedure": { "id": "...", "name": "...", "duration": 90 }
}
```
→ Зелёный блок в UI. Кнопка "Potwierdź w tym samym terminie".

#### Сценарий B: `can_shift_back` — нельзя продлить вперёд, но можно сдвинуть начало раньше
```json
{
  "result": {
    "status": "can_shift_back",
    "message": "Nie można wydłużyć w aktualnym terminie",
    "reason": "konflikt z kolejną rezerwacją",
    "suggestedStartISO": "2026-04-10T09:30:00+02:00",
    "suggestedEndISO": "2026-04-10T11:00:00+02:00",
    "shiftMinutes": 30,
    "alternativeSlots": [
      { "startISO": "2026-04-10T09:00:00+02:00", "endISO": "2026-04-10T10:30:00+02:00" },
      { "startISO": "2026-04-10T08:30:00+02:00", "endISO": "2026-04-10T10:00:00+02:00" }
    ]
  }
}
```
→ Жёлтый блок с предложением. Кнопка "Potwierdź o 09:30". Раскрывающийся список альтернатив.

#### Сценарий C: `no_availability` — вообще нет места в этот день
```json
{
  "result": {
    "status": "no_availability",
    "message": "Brak wolnych terminów w tym dniu"
  }
}
```
→ Красный блок. Кнопка "Wybierz nowy termin" (открывает календарь).

---

## Алгоритм сдвига (check-extension) — подробная логика

```
ВХОД: currentStart, currentEnd, newDuration, masterId

1. newEnd = currentStart + newDuration
2. Получить busyRanges для этого дня (все записи мастера КРОМЕ текущей)
3. Получить openRanges для этого дня (из Schedule/DateOverride)

ПРОВЕРКА A: Можно ли просто продлить?
   - Если newEnd вписывается в openRanges И не пересекается с busyRanges → "can_extend"

ПРОВЕРКА B: Можно ли сдвинуть назад?
   - Для shiftMin от 15 до 120 с шагом 15:
     - shiftedStart = currentStart - shiftMin
     - shiftedEnd = shiftedStart + newDuration
     - Если shiftedStart >= начало рабочего дня
       И [shiftedStart, shiftedEnd] не пересекается с busyRanges
       И вписывается в openRanges
       → "can_shift_back" с suggestedStart/End и shiftMinutes
   - Дополнительно: собрать до 5 альтернативных слотов в этот день

ПРОВЕРКА C: Если ничего не подошло → "no_availability"
```

---

## План реализации

### Шаг 0: Предварительная проверка
- [ ] Убедиться что `@tanstack/react-query` установлен в `package.json`
- [ ] Убедиться что Prisma клиент актуален (`npx prisma generate`)
- [ ] Подтвердить что API `/api/procedures` работает корректно (уже реализован)

---

### Шаг 1: Создать API `/api/bookings/all/route.ts` (Поиск записей)

**Файл**: `src/app/api/bookings/all/route.ts`

- [x] Создать файл `src/app/api/bookings/all/route.ts`
- [x] Реализовать `GET` обработчик
- [x] Принять query params: `masterId` (обязательный), `phone` (обязательный), `name` (обязательный)
- [x] Валидировать наличие `masterId`, `phone`, `name` → 400 если отсутствуют
- [x] Нормализовать телефон для поиска: оставить только последние 9 цифр (убрать код страны, пробелы, дефисы)
- [x] SQL-запрос через Prisma (фильтр по masterId, date >= today, status PENDING/CONFIRMED)
- [x] После SQL-выборки — дополнительно проверить совпадение имени (нормализованное сравнение: trim, lowercase, убрать лишние пробелы)
- [x] Для каждой записи вычислить `canModify` и `canCancel`
- [x] Маппинг полей (eventId, firstName, lastName, phone, email, procedureName, procedureId, startTime ISO, endTime ISO, price)
- [x] Возвращать формат: `{ bookings: [...], count: N, cached: false }`
- [x] **Обновить** `bookingManagementApi.ts` — `searchBookings()` теперь передаёт phone+name в query, клиентская фильтрация удалена


---

### Шаг 2: Создать API `/api/bookings/cancel/route.ts` (Отмена записи)

**Файл**: `src/app/api/bookings/cancel/route.ts`

- [ ] Создать файл `src/app/api/bookings/cancel/route.ts`
- [ ] Реализовать `POST` обработчик
- [ ] Принять body: `{ eventId, firstName, phone, email?, masterId? }`
- [ ] Найти `Appointment` по `id = eventId`
- [ ] Верификация владельца:
  - Получить `client` через `appointment.clientId`
  - Сравнить `client.phone` (последние 9 цифр) с `phone` из запроса
  - Если не совпадает → 403 `VERIFICATION_FAILED`
- [ ] Проверить что до записи >24 часа (серверная валидация дублирует UI-скрытие):
  - Построить `appointmentDateTime` из `date + startTime` в Europe/Warsaw
  - Если `appointmentDateTime - now < 24h` → 400 `TOO_LATE_TO_CANCEL`
- [ ] Обновить `status = "CANCELLED"`
- [ ] Вернуть 200 OK

> Примечание: В UI кнопка отмены полностью СКРЫТА если canModify=false (<24ч), но сервер всё равно проверяет 24ч как дополнительный уровень безопасности.

---

### Шаг 3: Создать API `/api/bookings/update-time/route.ts` (Изменение времени)

**Файл**: `src/app/api/bookings/update-time/route.ts`

- [ ] Создать файл `src/app/api/bookings/update-time/route.ts`
- [ ] Реализовать `POST` обработчик
- [ ] Принять body: `{ eventId, procedureName, firstName, lastName, phone, email, price, newStartISO, newEndISO, masterId? }`
- [ ] Найти `Appointment` по `id = eventId`
- [ ] Верификация владельца (аналогично cancel)
- [ ] Извлечь date/time из ISO строк:
  - Использовать `Intl.DateTimeFormat` с `Europe/Warsaw` timezone (как в `/api/book`)
  - `newDate` = дата из `newStartISO`
  - `newStartTime` = "HH:mm" из `newStartISO`
  - `newEndTime` = "HH:mm" из `newEndISO`
- [ ] Проверить конфликт:
  - Запросить `Appointment.findFirst` с перекрытием по `masterId + date + startTime/endTime`
  - Исключить текущую запись из проверки (`id: { not: eventId }`)
  - Если конфликт → 409 `CONFLICT`
- [ ] Обновить: `appointment.update({ date, startTime, endTime })`
- [ ] Вернуть 200 OK

---

### Шаг 4: Создать API `/api/bookings/update-procedure/route.ts` (Изменение процедуры)

**Файл**: `src/app/api/bookings/update-procedure/route.ts`

- [ ] Создать файл `src/app/api/bookings/update-procedure/route.ts`
- [ ] Реализовать `POST` обработчик
- [ ] Принять body: `{ eventId, firstName, lastName, phone, email, currentStartISO, newProcedureId, masterId? }`
- [ ] Найти `Appointment` и `Service` (новый)
- [ ] Верификация владельца
- [ ] Пересчитать `endTime`:
  - Парсить `startTime` из существующей записи
  - `newEndMinutes = startMinutes + newService.duration`
  - Форматировать как "HH:mm"
- [ ] Обновить: `appointment.update({ serviceId: newProcedureId, endTime: newEndTime })`
- [ ] Вернуть 200 OK

---

### Шаг 5: Создать API `/api/bookings/[id]/route.ts` (Комбинированное изменение)

**Файл**: `src/app/api/bookings/[id]/route.ts`

- [ ] Создать файл `src/app/api/bookings/[id]/route.ts`
- [ ] Реализовать `PATCH` обработчик
- [ ] Принять body: `{ newProcedureId?, newStartISO?, newEndISO?, masterId? }`
- [ ] Найти `Appointment` по `id` из URL params
- [ ] Если `newStartISO`/`newEndISO` заданы — проверить конфликт (как в update-time)
- [ ] Если `newProcedureId` задан — обновить `serviceId`
- [ ] Обновить `date`, `startTime`, `endTime`, `serviceId` в одном `update()`
- [ ] Вернуть `{ changes: { startTime?, endTime?, procedure? } }`

---

### Шаг 6: Создать API `/api/bookings/[id]/check-extension/route.ts` (Умный сдвиг)

**Файл**: `src/app/api/bookings/[id]/check-extension/route.ts`

> ⚠️ ВАЖНО: Это самый сложный эндпоинт. Он реализует алгоритм "умного сдвига".

- [ ] Создать файл `src/app/api/bookings/[id]/check-extension/route.ts`
- [ ] Реализовать `POST` обработчик
- [ ] Принять body: `{ eventId, currentStartISO, currentEndISO, newProcedureId, masterId? }`
- [ ] Получить новую Service (`newProcedureId`) — узнать `duration`
- [ ] Получить `masterId` из appointment или body
- [ ] Извлечь дату записи в формате "YYYY-MM-DD"

**Реализовать 3-шаговую проверку**:

- [ ] **Шаг A: can_extend** — Проверка простого продления
  - Вычислить `currentStartMinutes` из `startTime`
  - `newEndMinutes = currentStartMinutes + newDuration`
  - Получить `openRanges` для даты (из Schedule/DateOverride — переиспользовать логику из `availability.ts`)
  - Получить `busyRanges` для даты (все Appointments кроме текущего)
  - Проверить что `[currentStartMinutes, newEndMinutes]`:
    - Вписывается в один из `openRanges`
    - Не пересекается ни с одним из `busyRanges`
  - Если ОК → вернуть `{ status: "can_extend", message: "..." }`

- [ ] **Шаг B: can_shift_back** — Поиск сдвига назад
  - Для `shiftMin` от 15 до 120 с шагом 15:
    - `shiftedStart = currentStartMinutes - shiftMin`
    - `shiftedEnd = shiftedStart + newDuration`
    - Проверить `shiftedStart >= 0`
    - Проверить что `[shiftedStart, shiftedEnd]` вписывается в `openRanges`
    - Проверить что нет пересечений с `busyRanges`
    - Если ОК → запомнить как `suggested`
    - break при первом удачном (минимальный сдвиг)
  - Собрать альтернативные слоты (до 5): все свободные окна на этот день длительностью >= newDuration
  - Если найден `suggested`:
    - Определить `reason`: "konflikt z kolejną rezerwacją" или "poza godzinami pracy"
    - Конвертировать минуты обратно в ISO строки (Europe/Warsaw)
    - Вернуть `{ status: "can_shift_back", suggestedStartISO, suggestedEndISO, shiftMinutes, reason, alternativeSlots }`

- [ ] **Шаг C: no_availability**
  - Если ни A, ни B не сработали → `{ status: "no_availability", message: "..." }`

- [ ] Также вернуть `currentBooking` и `newProcedure` в ответе

**Переиспользовать утилиты из `availability.ts`**:
- [ ] Вынести `readWeeklyFromDb`, `readOverridesFromDb`, `fetchBusyRanges`, `intervalsToRanges`, `minusBusy`, `t2m` в экспортируемые функции (или создать shared helper `src/lib/schedule-utils.ts`)

---

### Шаг 7: Адаптировать фронтенд API-клиент

**Файл**: `src/components/booking-management/api/bookingManagementApi.ts`

**Решение: Вариант B** — серверная фильтрация. Сервер получает `phone` + `name` и возвращает уже отфильтрованные записи. Клиент никогда не видит чужие данные.

- [ ] В функции `searchBookings()` изменить URL запроса:
  - **Было**: `GET /api/bookings/all?force=true&masterId=xxx` → получить всё, фильтровать на клиенте
  - **Стало**: `GET /api/bookings/all?masterId=xxx&phone=+48...&name=Наталія` → сервер возвращает только нужные записи
- [ ] Удалить всю логику клиентской фильтрации из `searchBookings()` (блок `filterBookings()` / `matchesSearchCriteria()` и т.д.)
- [ ] Удалить обработку `extended_search` из `searchBookings()` — параметры `start`/`end` больше не нужны, сервер сам знает что брать от `now()` вперёд
- [ ] `mapApiResult()` остаётся — формат ответа не меняется
- [ ] Проверить что формат ответа `/api/bookings/all` совпадает с ожиданиями `mapApiResult()`:
  - Поля: `eventId`, `firstName`, `lastName`, `phone`, `email`, `procedureName`, `startTime` (ISO), `endTime` (ISO), `price`, `canModify`, `canCancel`

---

### Шаг 8: Обновить Zod-схемы валидации

**Файл**: `src/lib/validation/api-schemas.ts`

- [ ] Обновить `cancelBookingApiSchema` — убрать `name`, добавить `firstName`
- [ ] Обновить `updateTimeApiSchema` — привести в соответствие с фактическим body
- [ ] Обновить `updateProcedureApiSchema` — добавить `currentStartISO`
- [ ] Обновить `checkExtensionApiSchema` — заменить `newDurationMin` на `newProcedureId`
- [ ] Добавить новую схему для PATCH `/api/bookings/[id]`

---

### Шаг 9: Вынести shared-утилиты

**Файл**: `src/lib/schedule-utils.ts` (НОВЫЙ)

- [x] Создать файл `src/lib/schedule-utils.ts`
- [x] Экспортировать из `availability.ts` (или скопировать):
  - `readWeeklyFromDb(masterId)` — чтение недельного расписания
  - `readOverridesFromDb(masterId, from, until)` — чтение оверрайдов
  - `fetchBusyRanges(masterId, dateISO, excludeAppointmentId?)` — получение занятых слотов (с возможностью исключить текущую запись)
  - `intervalsToRanges(intervals)` — конвертация интервалов
  - `minusBusy(open, busy)` — вычитание занятых из свободных
  - `t2m(timeStr)` — конвертация "HH:mm" в минуты
  - `m2t(minutes)` — конвертация минут в "HH:mm" (НОВАЯ)
  - `fitsInOpen(open, start, end)` — проверка что слот вписывается в рабочие часы (НОВАЯ)
  - `overlapsWithBusy(busy, start, end)` — проверка пересечения с занятыми (НОВАЯ)
  - `getOpenRangesForDate(masterId, dateISO)` — открытые окна для даты (НОВАЯ, удобная обёртка)
- [x] Обновить `availability.ts` чтобы импортировать эти утилиты из `schedule-utils.ts`

---

### Шаг 10: Дымовое тестирование

- [ ] Запустить `npm run dev`
- [ ] Проверить что build не ломается
- [ ] На странице мастера (`/[masterId]`) открыть панель "Zarządzaj rezerwacją"
- [ ] Ввести данные клиента и найти запись
- [ ] Проверить отображение найденных записей
- [ ] Проверить что для записей <24ч кнопки скрыты и показан текст "свяжитесь с мастером"
- [ ] Проверить изменение времени (direct-time-change flow)
- [ ] Проверить изменение процедуры:
  - Короче/такая же → прямое подтверждение
  - Длиннее → check-extension → 3 сценария
- [ ] Проверить отмену записи
- [ ] Проверить ошибочные сценарии (конфликты, серверная валидация 24ч)

---

## Что НЕ нужно менять

> Главная работа — создать 6 серверных API-эндпоинтов. Минимальные изменения во фронтенде только в API-клиенте (убрать клиентский фильтр) и удалить ExtendedSearchPanel.

- ✅ `BookingManagement.tsx` — без изменений
- ✅ `PanelRenderer.tsx` — без изменений (кроме удаления рендера `extended_search` панели)
- ✅ `useBookingMutations.ts` — без изменений
- ✅ `useTurnstileSession.ts` — без изменений
- ✅ `types.ts` — без изменений (тип `ManagementState` — убрать `extended_search` из union)
- ✅ Все остальные UI-панели (17 штук) — без изменений
- ⚠️ `bookingManagementApi.ts` — упростить `searchBookings()`, передавать phone+name в query (Шаг 7)
- ⚠️ `useBookingManagementState.ts` — удалить state `extended_search` и связанные actions
- ⚠️ `useBookingHandlers.ts` — удалить обработчики `handleExtendedSearch`, `handleGoToExtendedSearch`
- ⚠️ `api-schemas.ts` — обновление Zod-схем (Шаг 8)
- 🗑️ `ExtendedSearchPanel.tsx` — **УДАЛИТЬ** (была нужна только для Google Calendar API)

---

## Рекомендуемый порядок выполнения

1. **Шаг 9** (schedule-utils) → базовые утилиты для переиспользования
2. **Шаг 0** (проверки зависимостей)
3. **Шаг 1** (search/all) → можно сразу протестировать поиск
4. **Шаг 2** (cancel) → простой CRUD
5. **Шаг 3** (update-time)
6. **Шаг 4** (update-procedure)
7. **Шаг 5** (combined update)
8. **Шаг 6** (check-extension) → самый сложный, требует утилит из Шага 9
9. **Шаг 7-8** (фронтенд адаптация + схемы)
10. **Шаг 10** (тестирование)

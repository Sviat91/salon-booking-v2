# 🔐 Регистрация клиентов и Личный кабинет — План реализации

> **Цель**: Добавить клиентскую регистрацию (по email + пароль) и полноценный личный кабинет (`/profile`) с историей записей, управлением данными и быстрой повторной записью.

> **🚨 ВНИМАНИЕ ДЛЯ СЛЕДУЮЩЕГО АГЕНТА (После выполнения, удалите этот блок):**
> Текущие приоритетные доработки от пользователя перед закрытием эпика:
> **1. In-place редактирование профиля при бронировании:** В `BookingForm.tsx` кнопка "Edit" в блоке "Your Details" перебрасывает на страницу `/profile/edit`. Нужно переделать так, чтобы редактирование открывалось прямо в этом же окне (окошко/модалка), и после изменения система предлагала обновить данные глобально в профиле.
> **2. Редактирование записей из ЛК (`/profile`):** Нужно добавить возможность редактировать свои будущие записи напрямую из кабинета. Формат: выбираем запись -> открываем сценарий окна редактирования (адаптировать текущий уже существующий флоу под ЛК и залогиненного клиента).
> **3. GDPR Consents при регистрации:** Все согласия (Data Processing, Terms, и т.д.) нужно запрашивать у клиента **при регистрации** (в `RegisterForm.tsx` и `api/auth/register`), а не во время бронирования (для зарегистрированных пользователей эти шаги при бронировании должны скрываться).

---

## 📖 Контекст: что уже есть

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `User` модель (Prisma) | ✅ Есть | Поля: name, email, phone, password, role, isGuest |
| `POST /api/auth/register` | ⚠️ Есть, но базовый | Требует name + email + password, создаёт CLIENT |
| `RegisterForm.tsx` | ⚠️ Есть, базовый | Поля: name, email, password. Без phone |
| `/auth/login` + `LoginForm.tsx` | ✅ Есть | Вход по email + password (Credentials Provider) |
| `auth.ts` (NextAuth) | ✅ Есть | JWT strategy, Credentials provider по email |
| `auth.config.ts` | ✅ Есть | JWT/session callbacks, pages config |
| `middleware.ts` | ✅ Есть | Защищает `/admin`, но не `/profile` |
| `/profile/page.tsx` | ⚠️ Есть | Работает без auth — ввод телефона → список записей |
| `/api/client/appointments` | ✅ Есть | GET по phone → все записи |
| Идентификация гостей | ✅ Есть | По паре (phone + name), `isGuest: true` |
| GDPR Consent | ✅ Есть | `consent-service.ts`, `/api/consents/*` |

### Ключевые решения
- **Регистрация по email + пароль**. Телефон не нужен для auth — это идентификатор гостя.
- **Гостевой флоу НЕ меняется** — запись без регистрации сохраняется (PRD §3).
- **OAuth-ready**: email как primary identifier открывает путь к Google, Apple, Telegram auth.
- **Guest merge**: Зарегистрированный клиент может привязать телефон → гостевые записи привяжутся.

---

## 🏗 Архитектура решения

### Два типа клиентов
1. **Гость** (`isGuest: true`, `password: null`) — записывается по phone+name без регистрации
2. **Зарегистрированный** (`isGuest: false`, `password != null`, `email != null`) — вошёл в ЛК

### Флоу авторизации
```
Регистрация: name + email + password → email verification (будущее)
Вход: email + password (Credentials Provider — уже работает!)
Будущее: + Google OAuth, Apple Sign-In, Telegram Login Widget
```

### Guest merge (привязка гостевых записей)
```
1. Клиент регистрируется → создаётся User с isGuest=false
2. В ЛК идёт в "Привязать записи" → вводит phone + name
3. Система ищет Guest-юзеров с (phone + name)
4. Найденные записи перепривязываются к зарегистрированному User
5. Guest-юзер удаляется (или помечается как merged)
```

### Маршруты
| Маршрут | Доступ | Описание |
|---------|--------|----------|
| `/auth/register` | Публичный | Регистрация: name + email + пароль |
| `/auth/login` | Публичный | Вход: email + пароль |
| `/profile` | Только auth (CLIENT) | ЛК: записи, профиль, настройки |
| `/profile/edit` | Только auth (CLIENT) | Редактирование профиля |

---

## 📋 Пошаговый план реализации

### Фаза 1: Backend — Доработка auth

#### Шаг 1.1: Обновить `POST /api/auth/register`
- [x] Валидация: `name` ≥ 2, `email` валидный формат, `password` ≥ 6
- [x] Проверка дубликата по email: `findFirst({ email, password: { not: null } })` — ищем только зарегистрированных (не гостей с фейковым email)
- [x] Создание: `{ name, email, password: bcrypt(password), role: "CLIENT", isGuest: false }`
- [x] Автоматический логин после регистрации (уже работает)
- [x] Zod-схема для валидации body

**Файл**: `src/app/api/auth/register/route.ts` [MODIFY]

```
Body: { name: string, email: string, password: string }
Response 201: { id, name, email, role }
Response 400: { error: "..." }
```

#### Шаг 1.2: Убедиться что NextAuth Credentials Provider корректен
- [x] `authorize()` в `auth.ts` — уже ищет по email+password для master/admin
- [x] Убедиться что CLIENT с `isGuest: false` тоже может залогиниться (текущий код это уже позволяет!)
- [x] `findFirst({ email })` уже используется → ОК

**Файл**: `src/auth.ts` — скорее всего изменений НЕ нужно. Просто проверить.

#### Шаг 1.3: Расширить JWT/Session данными клиента
- [x] Добавить `phone` в JWT token (из user БД → token → session)
- [x] Добавить `name` в session (может уже есть)
- [x] Расширить TypeScript типы NextAuth

**Файлы**:
- `src/auth.config.ts` [MODIFY] — callbacks
- `src/types/next-auth.d.ts` [NEW или MODIFY] — type augmentation

```ts
// JWT callback
async jwt({ token, user }) {
  if (user) {
    token.role = user.role
    token.id = user.id
    token.phone = user.phone  // ← ADD
  }
  return token
}

// Session callback
async session({ session, token }) {
  if (session.user) {
    session.user.role = token.role
    session.user.id = token.id
    session.user.phone = token.phone  // ← ADD
  }
  return session
}
```

#### Шаг 1.4: Обновить Middleware — защитить `/profile`
- [x] Добавить `/profile` в matcher
- [x] Если не залогинен → redirect `/auth/login?callbackUrl=/profile`
- [x] Если CLIENT → разрешить
- [x] Если MASTER/SUPERADMIN → разрешить (они тоже могут смотреть)
- [x] После логина CLIENT → redirect на `/profile`

**Файл**: `src/middleware.ts` [MODIFY]

---

### Фаза 2: Frontend — Формы auth

#### Шаг 2.1: Обновить `RegisterForm.tsx`
- [x] Текущие поля уже правильные: name, email, password
- [x] Обновить тексты/labels на клиентский контекст (не "Create Account" а "Зарегистрироваться")
- [x] Добавить i18n ключи (PL / RU / EN)
- [x] После успешной регистрации → redirect `/profile`
- [x] Добавить ссылку "Уже есть аккаунт? Войти"

**Файл**: `src/components/auth/RegisterForm.tsx` [MODIFY]

#### Шаг 2.2: Обновить `LoginForm.tsx`
- [x] Обновить тексты на клиентский контекст
- [x] i18n ключи
- [x] После логина CLIENT → redirect `/profile`
- [x] Обработка `callbackUrl` из query params

**Файл**: `src/components/auth/LoginForm.tsx` [MODIFY]

#### Шаг 2.3: Обновить страницы auth
- [x] `/auth/login/page.tsx` — i18n тексты, мета-описание
- [x] `/auth/register/page.tsx` — i18n тексты, мета-описание
- [x] Обе страницы: дизайн соответствует основной теме салона

**Файлы**: `src/app/auth/login/page.tsx`, `src/app/auth/register/page.tsx` [MODIFY]

---

### Фаза 3: Личный кабинет (`/profile`)

#### Шаг 3.1: API — `GET /api/client/profile`
- [x] Auth-protected: userId из session
- [x] Возвращает:
  ```json
  {
    "user": { "name", "email", "phone", "createdAt" },
    "upcoming": [{ appointment... }],  // date >= today, status != CANCELLED, sort ASC
    "past": [{ appointment... }],       // date < today OR CANCELLED, sort DESC
    "stats": { "totalVisits", "lastVisit" }
  }
  ```
- [x] Если у пользователя есть phone → искать и его записи (merge view)
- [x] Price override: как в `/api/bookings/all`

**Файл**: `src/app/api/client/profile/route.ts` [NEW]

#### Шаг 3.2: Переработать `/profile/page.tsx`
- [x] **Убрать** ручной ввод телефона. Данные из auth session.
- [x] Layout:
  ```
  ┌─────────────────────────────┐
  │  👤 Привет, {name}!         │ ← из session
  │  ✉️ {email}                  │
  │  📱 {phone || "не указан"}  │
  │  [Редактировать] [Выйти]    │
  ├─────────────────────────────┤
  │  📅 Предстоящие записи      │
  │  ├── Booking card 1         │ ← service, date, time, master, price
  │  │   [Изменить] [Отменить]  │ ← 24ч guard
  │  └── Booking card 2         │
  ├─────────────────────────────┤
  │  📜 История                 │
  │  ├── Past card [Повторить]  │ ← redirect на мастера
  │  └── Past card [Повторить]  │
  ├─────────────────────────────┤
  │  🔗 Привязать записи        │ ← если phone не указан
  │  "Введите телефон чтобы     │
  │   привязать гостевые записи"│
  ├─────────────────────────────┤
  │  ⚙️ Настройки               │
  │  ├── Сменить пароль         │
  │  ├── 🔐 GDPR: Мои данные   │
  │  └── 🚪 Выйти              │
  └─────────────────────────────┘
  ```
- [x] React Query для загрузки данных из `/api/client/profile`
- [x] Responsive дизайн
- [x] i18n

**Файл**: `src/app/profile/page.tsx` [REWRITE]

#### Шаг 3.3: API — `PATCH /api/client/profile`
- [x] Auth-protected
- [x] Обновляет: `name`, `email` (phone — отдельный flow через merge)
- [x] Валидация: name ≥ 2, email — формат
- [x] Проверка уникальности email среди зарегистрированных (password != null)

**Файл**: `src/app/api/client/profile/route.ts` [ADD PATCH handler]

#### Шаг 3.4: API — `POST /api/client/change-password`
- [x] Auth-protected
- [x] Body: `{ currentPassword, newPassword }`
- [x] Валидация: currentPassword верный (bcrypt compare), newPassword ≥ 6
- [x] Обновить password hash в БД

**Файл**: `src/app/api/client/change-password/route.ts` [NEW]

#### Шаг 3.5: Страница `/profile/edit`
- [x] Форма: name (editable), email (editable), phone (readonly display)
- [x] Секция смены пароля: current + new + confirm
- [x] Кнопка "Сохранить"
- [x] Toast/уведомление об успехе
- [x] Back button → `/profile`

**Файл**: `src/app/profile/edit/page.tsx` [NEW]

---

### Фаза 4: Guest Merge — привязка гостевых записей (Без СМС)

#### Шаг 4.1: API — `POST /api/client/link-bookings`
- [ ] Auth-protected: доступно только для авторизованных клиентов (проверка сессии и UID).
- [ ] Body: `{ name, phone }` — данные, которые клиент указывал как гость.
- [ ] Логика (Имя + Телефон выступают в роли валидатора, аналогично логике управления гостевыми записями):
  1. Найти Guest-пользователя(ей) в БД, у которых `phone == phone` И `name == name` И `isGuest: true`.
  2. Перенести все `Appointments`: изменить `clientId` с найденных Guest UID на UID текущего авторизованного пользователя.
  3. Перенести записи согласия (`Consents`), если они привязаны к Guest UID.
  4. Удалить "пустого" Guest-юзeра, чтобы не засорять базу.
- [ ] Вернуть клиенту `{ linked: number }` (количество привязанных записей).

**Файл**: `src/app/api/client/link-bookings/route.ts` [NEW]

```json
Body: { "name": "Sviat", "phone": "+48501748708" }
Response: { "linked": 3 }
```

#### Шаг 4.2: UI — "Привязать гостевые записи" в ЛК
- [ ] Блок-карточка в `/profile` под списком записей (показывать только если есть смысл искать).
- [ ] Поля: `Имя` и `Телефон` (переиспользование стилистики SearchPanel или BookingForm, чтобы пользователь сразу узнал форму).
- [ ] Текст-подсказка: "Укажите имя и телефон в точности так, как вы вводили их при записи без регистрации".
- [ ] Кнопка "Найти и привязать".
- [ ] Индикация загрузки, обработка ошибок (если записей нет) и toast об успехе.
- [ ] После успешного связывания инвалидировать/перезагрузить query `clientProfile`, чтобы записи моментально появились на экране.

**Файл**: Секция/Компонент в `src/app/profile/page.tsx` или отдельный `LinkBookingsCard.tsx` [NEW]

---

### Фаза 5: Интеграция с booking flow

#### Шаг 5.1: After booking — предложить регистрацию/логин
- [ ] После успешной гостевой записи показать баннер:
  > "Хотите управлять записями? Создайте аккаунт или войдите"
  > [Создать аккаунт] [Войти] [Нет, спасибо]
- [ ] "Создать аккаунт" → `/auth/register`
- [ ] "Войти" → `/auth/login?callbackUrl=/profile`

**Файл**: Определить success-компонент после бронирования

#### Шаг 5.2: Автозаполнение при записи для залогиненного клиента
- [ ] Если клиент залогинен → автозаполнить имя и phone из session в форме записи
- [ ] Это упрощает повторную запись (не нужно вводить данные заново)
- [ ] Если phone в session есть → подставить

**Файл**: Booking form component (определить точный файл)

---

### Фаза 6: Навигация

#### Шаг 6.1: Header — кнопка профиля/входа
- [x] В header/navbar:
  - Залогинен → иконка 👤 + "Мой кабинет" → `/profile`
  - Не залогинен → "Войти" / "Зарегистрироваться"
- [x] Responsive: иконка на мобильном

**Файлы**: Header/Layout component

#### Шаг 6.2: Redirect после логина для CLIENT
- [x] В middleware: CLIENT login → redirect `/profile`
- [x] Учитывать `callbackUrl` если указан

**Файл**: `src/middleware.ts` [MODIFY]

---

### Фаза 7: GDPR в ЛК

#### Шаг 7.1: Секция "Мои данные"
- [ ] Показать текущие consent records
- [ ] Кнопка "Экспортировать данные" → `/api/consents/export`
- [ ] Кнопка "Удалить данные" → `/api/consents/erase` + confirm modal
- [ ] Кнопка "Отозвать согласие" → `/api/consents/withdraw`

**Файл**: Компонент в `/profile` или отдельная страница

---

### Фаза 8: Cleanup и тестирование

#### Шаг 8.1: Обновить `/api/client/appointments`
- [ ] Решить: оставить публичный endpoint (для совместимости) или сделать auth-only
- [ ] Рекомендация: оставить, но добавить rate limiting в будущем

#### Шаг 8.2: TypeScript типы NextAuth
- [ ] Расширить типы:
  ```ts
  declare module "next-auth" {
    interface User { role: string; phone?: string | null }
  }
  declare module "next-auth/jwt" {
    interface JWT { role: string; id: string; phone?: string | null }
  }
  ```
- [ ] Проверить/создать `src/types/next-auth.d.ts`

#### Шаг 8.3: i18n — все новые ключи
- [ ] PL / RU / EN для:
  - Регистрация/логин формы
  - Личный кабинет
  - Link bookings
  - Ошибки и уведомления

#### Шаг 8.4: Smoke тестирование
- [ ] Регистрация нового клиента (email + password + name)
- [ ] Логин по email
- [ ] Просмотр `/profile` → записи видны (если phone привязан)
- [ ] Гостевая запись → записи есть в БД
- [ ] Guest merge: записался как гость → зарегился → привязал по phone+name → записи в ЛК
- [ ] Редактирование профиля (name, email)
- [ ] Смена пароля
- [ ] Кнопка "Повторить" → redirect на мастера
- [ ] Кнопка "Выйти"
- [ ] GDPR экспорт/удаление
- [ ] Мастер/Админ логин не сломан
- [ ] Middleware: `/profile` без auth → redirect на login
- [ ] Middleware: CLIENT logon → redirect `/profile`

---

## 📐 Схема данных

Модель `User` **не требует изменений** в Prisma schema:
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?        // ← есть
  email         String?        // ← auth identifier
  phone         String?        // ← гостевой identifier, добавляется через link-bookings
  password      String?        // ← bcrypt hash для зарегистрированных
  role          String    @default("CLIENT")   // ← есть
  isGuest       Boolean   @default(false)      // ← guest vs registered
  // ... остальные поля
}
```

**Зарегистрированный клиент**: `isGuest=false`, `email!=null`, `password!=null`
**Гость**: `isGuest=true`, `phone!=null`, `password=null`

---

## 🔮 Будущие OAuth провайдеры (out of scope сейчас)

| Provider | Что даёт | Сложность |
|----------|----------|-----------|
| Google | email + name + avatar | 🟢 Лёгкая — NextAuth имеет встроенный Google Provider |
| Apple | email + name | 🟡 Средняя — нужен Apple Developer Account |
| Telegram | username + id (email не всегда) | 🟡 Средняя — Telegram Login Widget |

Все эти провайдеры дают email → merge по email будет работать автоматически.

---

## ⚠️ Важные моменты

1. **Обратная совместимость**: Гостевой флоу записи НЕ ломается.
2. **Email — единственный auth identifier**: Никакого SMS, верификации телефона.
3. **Guest merge**: Явный action от пользователя — "Привязать записи" → ввести phone+name.
4. **Phone readonly**: В ЛК phone показывается но не редактируется напрямую (только через link-bookings).
5. **Security**: `/profile` + API — только auth. Middleware + server session check.
6. **Дубликат email**: Проверяется только среди `password != null` юзеров (гости могут иметь фейковый email).

---

## 📊 Приоритеты

| Фаза | Описание | Критичность | Оценка |
|------|----------|-------------|--------|
| 1 | Backend auth (register + JWT) | 🔴 Высокая | 1-2ч |
| 2 | Frontend auth (формы, i18n) | 🔴 Высокая | 2-3ч |
| 3 | Личный кабинет (profile + API) | 🔴 Высокая | 3-4ч |
| 4 | Guest merge (link-bookings) | 🟡 Средняя | 2ч |
| 5 | Интеграция с booking flow | 🟡 Средняя | 1-2ч |
| 6 | Навигация (header, redirects) | 🟡 Средняя | 1ч |
| 7 | GDPR в ЛК | 🟢 Низкая | 1ч |
| 8 | Cleanup и тесты | 🔴 Высокая | 1-2ч |

**Итого: ~13-17 часов работы**

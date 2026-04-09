# 🔐 Регистрация клиентов и Личный кабинет — План реализации

> **Цель**: Добавить клиентскую регистрацию (по телефону + имя + опциональный email/пароль) и полноценный личный кабинет (`/profile`) с историей записей, управлением данными и быстрой повторной записью.

---

## 📖 Контекст: что уже есть

| Компонент | Статус | Описание |
|-----------|--------|----------|
| `User` модель (Prisma) | ✅ Есть | Поля: name, email, phone, password, role, isGuest |
| `POST /api/auth/register` | ⚠️ Есть, но только для admin/master | Требует email + password, создаёт CLIENT без phone |
| `RegisterForm.tsx` | ⚠️ Есть, не для клиентов | Поля: name, email, password. Нет phone |
| `/auth/login` + `LoginForm.tsx` | ✅ Есть | Вход по email + password (Credentials Provider) |
| `auth.ts` (NextAuth) | ✅ Есть | JWT strategy, Credentials provider по email |
| `middleware.ts` | ✅ Есть | Защищает `/admin`, но не `/profile` |
| `/profile/page.tsx` | ⚠️ Есть | Работает без auth — ввод телефона → список записей |
| `/api/client/appointments` | ✅ Есть | GET по phone → все записи |
| Идентификация клиента | ✅ Есть | По паре (phone + name), isGuest=true |
| GDPR Consent | ✅ Есть | `consent-service.ts`, `/api/consents/*` |

### Ключевые решения, принятые ранее
- **Клиент НЕ обязан регистрироваться** для записи (гостевой флоу сохраняется — PRD §3).
- **Идентификация**: `(phone + name)` — у `User.phone` и `User.email` нет `@unique` constraint.
- **Auth**: NextAuth Credentials Provider по email + password (для master/admin). Клиенты пока идут как `isGuest: true`.

---

## 🏗 Архитектура решения

### Два типа клиентов
1. **Гость** (`isGuest: true`) — записывается без регистрации. Текущий флоу.
2. **Зарегистрированный** (`isGuest: false`, `password != null`) — вошёл в ЛК, видит историю, может управлять записями.

### Флоу авторизации клиента
```
Вариант A: Вход по телефону + пароль
Вариант B: Вход по email + пароль (уже работает через NextAuth)
```

### Маршруты
| Маршрут | Доступ | Описание |
|---------|--------|----------|
| `/auth/register` | Публичный | Регистрация клиента: имя + phone + пароль + email (опц.) |
| `/auth/login` | Публичный | Вход: phone/email + пароль |
| `/profile` | Только auth CLIENT | Личный кабинет: записи, профиль, GDPR |
| `/profile/edit` | Только auth CLIENT | Редактирование профиля |

---

## 📋 Пошаговый план реализации

### Фаза 1: Backend — Регистрация и авторизация клиента

#### Шаг 1.1: Обновить `POST /api/auth/register`
- [ ] Добавить поле `phone` (обязательное для CLIENT)
- [ ] Сделать `email` необязательным (optional) для CLIENT
- [ ] Добавить валидацию: phone ≥ 9 цифр, name ≥ 2 символа, password ≥ 6
- [ ] При регистрации искать существующих Guest-юзеров по `(phone + name)`:
  - Если найден `isGuest: true` → **конвертировать** в зарегистрированного (`isGuest: false`, установить password, email)
  - Если не найден → создать нового юзера с `isGuest: false`
- [ ] Дедупликация: если `(phone + name)` есть с `isGuest: false` → вернуть ошибку "Аккаунт уже существует"
- [ ] После создания автоматически залогинить (как сейчас)

**Файл**: `src/app/api/auth/register/route.ts`

```
Body: { name, phone, password, email? }
Response: { id, name, phone, email, role: "CLIENT" }
```

#### Шаг 1.2: Добавить вход по phone в NextAuth Credentials Provider
- [ ] Расширить `authorize()` в `src/auth.ts`:
  - Если передан `phone` → `findFirst({ phone, password != null })` → сравнить bcrypt
  - Если передан `email` → текущая логика (без изменений)
- [ ] Обновить `credentials` config: добавить `phone` как optional field
- [ ] Убедиться что JWT token содержит `role`, `id`, `name`, `phone`

**Файл**: `src/auth.ts`

#### Шаг 1.3: Обновить `auth.config.ts` → JWT callbacks
- [ ] Добавить `phone` в JWT token (для отображения в ЛК без лишних запросов)
- [ ] Добавить `name` в session

**Файл**: `src/auth.config.ts`

#### Шаг 1.4: Обновить Middleware для `/profile`
- [ ] Добавить `/profile` в protected routes
- [ ] CLIENT → разрешить `/profile`
- [ ] MASTER/SUPERADMIN → разрешить `/profile` (опционально, можно redirect в admin)
- [ ] Неавторизованный → redirect на `/auth/login?callbackUrl=/profile`

**Файл**: `src/middleware.ts`

---

### Фаза 2: Frontend — Регистрация клиента

#### Шаг 2.1: Переработать `RegisterForm.tsx`
- [ ] Добавить поле phone (PhoneInput компонент — уже есть)
- [ ] Сделать email опциональным (убрать `required`)
- [ ] Добавить пояснение: "Телефон будет использоваться для входа"
- [ ] Обновить `onSubmit` → передавать phone в API
- [ ] Добавить i18n ключи (PL + RU + EN)
- [ ] Стилизация — соответствие дизайн-системе

**Файл**: `src/components/auth/RegisterForm.tsx`

#### Шаг 2.2: Обновить `LoginForm.tsx` — вход по phone или email
- [ ] Добавить toggle/tabs: "По телефону" / "По email"
- [ ] При входе по телефону → передавать `phone` вместо `email` в `signIn("credentials", { phone, password })`
- [ ] При входе по email → текущая логика
- [ ] Обновить placeholder'ы и labels
- [ ] i18n ключи

**Файл**: `src/components/auth/LoginForm.tsx`

#### Шаг 2.3: Обновить страницы `/auth/login` и `/auth/register`
- [ ] Обновить тексты и descriptions для клиентского контекста
- [ ] Добавить ссылку на `/profile` после успешного логина для CLIENT
- [ ] i18n

**Файлы**: `src/app/auth/login/page.tsx`, `src/app/auth/register/page.tsx`

---

### Фаза 3: Личный кабинет (`/profile`)

#### Шаг 3.1: Переработать `/profile/page.tsx`
Текущая страница — просто ввод телефона. Нужно превратить в полноценный ЛК.

- [ ] Убрать ручной ввод телефона. Данные получать из NextAuth session
- [ ] Структура страницы:
  ```
  ┌─────────────────────────┐
  │  Привет, {name}!        │ ← из session
  │  📱 {phone}  ✉️ {email}  │
  │  [Редактировать профиль] │
  ├─────────────────────────┤
  │  📅 Предстоящие записи   │ ← с кнопками Изменить/Отменить
  │  ├── Booking 1           │
  │  └── Booking 2           │
  ├─────────────────────────┤
  │  📜 История              │ ← с кнопкой "Повторить"
  │  ├── Past 1  [Повторить] │
  │  └── Past 2  [Повторить] │
  ├─────────────────────────┤
  │  🔐 Настройки            │
  │  ├── Сменить пароль      │
  │  ├── GDPR: Мои данные    │
  │  └── Выйти               │
  └─────────────────────────┘
  ```
- [ ] Добавить кнопку "Записаться" (→ redirect на главную)

**Файл**: `src/app/profile/page.tsx`

#### Шаг 3.2: API — `GET /api/client/profile`
- [ ] Нужен новый эндпоинт: возвращает данные профиля + appointments
- [ ] Auth-protected: берёт userId из session
- [ ] Возвращает: `{ user: { name, phone, email }, upcoming: [...], past: [...] }`
- [ ] Фильтрация:
  - upcoming: `date >= today AND status != CANCELLED`, sort ASC
  - past: `date < today OR status == CANCELLED`, sort DESC
- [ ] Включить price override для мастера (как в `/api/bookings/all`)

**Файл**: `src/app/api/client/profile/route.ts` [NEW]

#### Шаг 3.3: API — `PATCH /api/client/profile`
- [ ] Auth-protected
- [ ] Позволяет обновить: `name`, `email` (phone менять нельзя — это идентификатор)
- [ ] Валидация: `name` ≥ 2, `email` формат (если указан)

**Файл**: `src/app/api/client/profile/route.ts` [добавить PATCH handler]

#### Шаг 3.4: API — `POST /api/client/change-password`
- [ ] Auth-protected
- [ ] Body: `{ currentPassword, newPassword }`
- [ ] Валидация: currentPassword correct, newPassword ≥ 6
- [ ] bcrypt hash нового пароля

**Файл**: `src/app/api/client/change-password/route.ts` [NEW]

#### Шаг 3.5: Страница редактирования профиля `/profile/edit`
- [ ] Форма: имя, email (phone показывается но не редактируется)
- [ ] Секция смены пароля (current + new + confirm)
- [ ] Кнопка "Сохранить"
- [ ] Toast/уведомление об успехе

**Файл**: `src/app/profile/edit/page.tsx` [NEW]

---

### Фаза 4: Интеграция с существующим флоу бронирования

#### Шаг 4.1: After booking — предложить регистрацию
- [ ] После успешной записи (гостевой флоу) показать баннер:
  > "Хотите видеть свои записи и управлять ими? Создайте аккаунт за 30 секунд"
  > [Создать аккаунт] [Нет, спасибо]
- [ ] Кнопка "Создать аккаунт" → redirect на `/auth/register?phone=XXX&name=XXX` (предзаполнение)
- [ ] Хранить phone/name в query params для предзаполнения формы регистрации

**Файл**: Компонент success booking (определить точный компонент)

#### Шаг 4.2: Предзаполнение формы регистрации
- [ ] `RegisterForm` → читать `searchParams` (`phone`, `name`)
- [ ] Предзаполнять поля из query params
- [ ] Показывать только поле пароля если phone+name уже заполнены

**Файл**: `src/components/auth/RegisterForm.tsx`, `src/app/auth/register/page.tsx`

#### Шаг 4.3: Guest → Registered merge
- [ ] При регистрации, если Guest-юзер с таким (phone+name) уже есть:
  - Не создавать нового, а **обновить** существующего: `isGuest: false`, добавить password, email
  - Все предыдущие записи автоматически привязаны (тот же userId)
- [ ] Это уже описано в Шаге 1.1, но проверить end-to-end

---

### Фаза 5: Навигация и UX

#### Шаг 5.1: Добавить кнопку "Мой профиль" на главную страницу
- [ ] В header/navbar добавить:
  - Если залогинен → иконка профиля + "Мой кабинет" → `/profile`
  - Если не залогинен → "Войти" → `/auth/login`
- [ ] Responsive: на мобильном — иконка, на десктопе — текст

**Файлы**: Header/Layout компонент (определить точный файл)

#### Шаг 5.2: Redirect после логина
- [ ] CLIENT логин → redirect на `/profile` (вместо `/`)
- [ ] MASTER логин → redirect на `/admin/master` (уже работает)
- [ ] SUPERADMIN логин → redirect на `/admin` (уже работает)

**Файл**: `src/middleware.ts`

#### Шаг 5.3: Кнопка "Выйти" в ЛК
- [ ] В `/profile` добавить кнопку "Выйти" → `signOut({ callbackUrl: "/" })`
- [ ] Подтверждение перед выходом

**Файл**: `src/app/profile/page.tsx`

---

### Фаза 6: GDPR в личном кабинете

#### Шаг 6.1: Секция "Мои данные" в ЛК
- [ ] Показать текущие согласия (consent records)
- [ ] Кнопка "Экспортировать мои данные" → `/api/consents/export`
- [ ] Кнопка "Удалить мои данные" → `/api/consents/erase` + подтверждение
- [ ] Кнопка "Отозвать согласие" → `/api/consents/withdraw`

**Файл**: Компонент в `/profile` или отдельная страница `/profile/privacy`

---

### Фаза 7: Cleanup и тестирование

#### Шаг 7.1: Удалить старый публичный `/profile`
- [ ] Убрать ручной ввод телефона (заменён на auth-based в Фазе 3)
- [ ] Убрать или адаптировать `/api/client/appointments` (если больше не нужен без auth)

#### Шаг 7.2: i18n — все новые ключи
- [ ] Добавить все тексты в PL / RU / EN:
  - Формы регистрации/логина
  - Личный кабинет
  - Уведомления и ошибки

#### Шаг 7.3: TypeScript типы
- [ ] Расширить `next-auth` types:
  ```ts
  declare module "next-auth" {
    interface User { role: string; phone?: string }
    interface Session { user: { role: string; id: string; phone?: string } }
  }
  ```
- [ ] Обновить JWT type

**Файл**: `src/types/next-auth.d.ts` (проверить существует ли)

#### Шаг 7.4: Smoke тестирование
- [ ] Регистрация нового клиента (phone + name + password)
- [ ] Логин по телефону
- [ ] Логин по email
- [ ] Просмотр ЛК → записи видны
- [ ] Гостевая запись → предложение зарегистрироваться
- [ ] Guest merge: записался как гость → зарегился → записи привязаны
- [ ] Редактирование профиля
- [ ] Смена пароля
- [ ] Выход
- [ ] GDPR экспорт/удаление
- [ ] Мастер/Админ логин не сломан
- [ ] Middleware: `/profile` без auth → redirect на login

---

## 📐 Схема данных

Существующая модель `User` **не требует изменений** в Prisma schema. Все поля уже есть:
- `name`, `email`, `phone`, `password` — для auth
- `isGuest` — отделяет гостей от зарегистрированных
- `role` — CLIENT / MASTER / SUPERADMIN

**Единственное изменение**: может понадобиться добавить `phone` в JWT token (auth.config.ts callbacks).

---

## ⚠️ Важные моменты

1. **Обратная совместимость**: Гостевой флоу записи НЕ ломается. Клиент по-прежнему может записаться без регистрации.
2. **Guest merge**: При регистрации с телефоном, который уже есть у гостя с тем же именем — мержим, не дублируем.
3. **Phone не меняется**: При редактировании профиля phone — readonly. Это идентификатор.
4. **Security**: `/profile` и `/api/client/profile` — только для auth users. Middleware + серверная проверка session.
5. **Один пароль на phone+name**: Два человека с одним телефоном и разными именами — два разных аккаунта с разными паролями.

---

## 📊 Приоритеты

| Фаза | Описание | Критичность | Оценка |
|------|----------|-------------|--------|
| 1 | Backend auth (register + login by phone) | 🔴 Высокая | 2-3ч |
| 2 | Frontend auth (формы) | 🔴 Высокая | 2-3ч |
| 3 | Личный кабинет (profile) | 🔴 Высокая | 3-4ч |
| 4 | Интеграция с booking flow | 🟡 Средняя | 1-2ч |
| 5 | Навигация и UX | 🟡 Средняя | 1ч |
| 6 | GDPR в ЛК | 🟢 Низкая | 1ч |
| 7 | Cleanup и тесты | 🔴 Высокая | 1-2ч |

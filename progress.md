## TASK-001 (done)

Инициализировано приложение **Next.js 15** (App Router) с **TypeScript**, **Tailwind CSS**, **ESLint**. Имя npm-пакета `workflowhub` (из‑за ограничений npm на заглавные буквы в имени; папка репозитория может оставаться `WorkflowHub`).

**Структура:** `app/`, `public/`, `components/`, `lib/` (заготовки с `.gitkeep`).

**Проверки:** `npm install`, `npm run build` — успешно; `npm run dev` — `GET / 200`, без ошибок в консоли сервера после открытия главной.

**Примечание:** на Node **v19** возможны предупреждения `EBADENGINE` у части dev-зависимостей; для продакшена рекомендуется **Node 20 LTS** или **18.18+** (см. README).

## TASK-002 (done)

Подключены **PostgreSQL** и **Prisma Migrate** (Prisma **6.19.x** — в схеме остаётся классический `url = env("DATABASE_URL")`; Prisma 7 потребовал бы отдельный `prisma.config.ts`).

**Артефакты:** [`prisma/schema.prisma`](./prisma/schema.prisma), первая миграция [`prisma/migrations/20250328112000_init`](./prisma/migrations/20250328112000_init), [`.env.example`](./.env.example) с `DATABASE_URL`, [`docker-compose.yml`](./docker-compose.yml) для локального Postgres, npm-скрипты `db:generate`, `db:migrate`, `db:migrate:deploy`, `db:studio`, `postinstall` → `prisma generate`.

**Базовая таблица:** `schema_baseline` — заглушка для пайплайна миграций; доменные модели пойдут в следующих задачах.

**Проверки:** `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` совпадает с закоммиченным `migration.sql`; `npm run build` — успешно. Полный цикл из `test_steps` задачи (поднять БД → `npm run db:migrate:deploy` → проверка схемы в клиенте) выполняется при запущенном PostgreSQL (например `docker compose up -d db` при доступном Docker).

## TASK-003 (done)

Реализована **загрузка и валидация env** для обязательного `DATABASE_URL` и всех ключей PRD §8: `MEDIA_IMAGE_MAX_MB`, `MEDIA_VIDEO_MAX_MB`, `ANON_COOKIE_TTL_DAYS`, `ANON_NEW_DEVICE_PER_IP_PER_WORKFLOW_HOUR`, `DOWNLOAD_RATE_LIMIT_PER_IP_PER_MIN`, `REVIEW_BODY_MAX_CHARS` (дефолты как в PRD; пустое/отсутствующее значение → дефолт; невалидное число → ошибка старта).

**Артефакты:** [`lib/env.ts`](./lib/env.ts) (Zod + `server-only`), импорт в [`app/layout.tsx`](./app/layout.tsx) для проверки при сборке/SSR; расширен [`.env.example`](./.env.example); в [README](README.md) кратко описана политика env.

**Проверки:** `npm run build` и `npm run lint` — успешно при заданном `DATABASE_URL`; без `DATABASE_URL` сборка падает с сообщением о необходимости переменной; `MEDIA_IMAGE_MAX_MB=7` + `npm run dev` — в логе старта строка `[workflowhub] env loaded — MEDIA_IMAGE_MAX_MB=7`; `MEDIA_IMAGE_MAX_MB=0` — сборка с понятной ошибкой валидации.

## TASK-004 (done)

Настроен **S3-совместимый клиент** (`@aws-sdk/client-s3`) для бакета артефактов: переменные `S3_ENDPOINT`, `S3_REGION` (дефолт `us-east-1`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`; при непустом `S3_BUCKET` обязательны ключи. Парсинг вынесен в [`lib/env-parse.ts`](./lib/env-parse.ts) (`parseEnv`), приложение по-прежнему подключает [`lib/env.ts`](./lib/env.ts) (`server-only`). Фабрика без `server-only`: [`lib/s3-factory.ts`](./lib/s3-factory.ts); кэширующий доступ в приложении: [`lib/s3.ts`](./lib/s3.ts). Smoke: `npm run storage:smoke` ([`scripts/s3-smoke.ts`](./scripts/s3-smoke.ts)) — загрузка `.env` / `.env.local`, `HeadBucket`; зависимости `tsx`, `dotenv` (dev).

**Проверки:** `DATABASE_URL=… npm run build` и `npm run lint` — успешно; без настроек S3 `npm run storage:smoke` завершается с осмысленным сообщением «S3 is not configured…»; при заданных MinIO/R2/S3 в `.env.local` ожидается `S3 smoke OK` или понятная ошибка SDK при неверных правах.

## TASK-005 (done)

Добавлена модель **User** (PRD §6.1) в [`prisma/schema.prisma`](./prisma/schema.prisma): enum `AuthProvider` (`google`, `github`), `UserRole` (`user`, `admin`), поля `id` (UUID, default в БД `gen_random_uuid()`), `provider`, `provider_subject`, опциональный `email`, `display_name`, `role`, `created_at`; таблица `users`, уникальный индекс на `(provider, provider_subject)`. Миграция: [`prisma/migrations/20250329120000_add_user`](./prisma/migrations/20250329120000_add_user).

Проверка уникальности: [`scripts/user-unique-smoke.ts`](./scripts/user-unique-smoke.ts) — `npm run db:user-smoke` после применения миграций (ожидается `P2002` на второй вставке с тем же провайдером и `provider_subject`). Вручную (после `npm run db:migrate:deploy`): одна вставка в `users`, вторая с тем же `(provider, provider_subject)` — ошибка уникальности от PostgreSQL.

**Проверки в репозитории:** `npx prisma validate`, `npm run lint`, `DATABASE_URL=… npm run build` — успешно. Полный цикл `test_steps` из `tasks.json` (миграции + вставка + дубликат) выполняется при запущенном PostgreSQL (`docker compose up -d db` при доступном Docker), затем `npm run db:migrate:deploy` и `npm run db:user-smoke`.

## TASK-006 (done)

Добавлены **Workflow** (PRD §6.2) и **WorkflowFile** (PRD §6.3) в [`prisma/schema.prisma`](./prisma/schema.prisma): enum `WorkflowStatus` (`draft`, `published`, `archived`), поля workflow по PRD включая денормализованные агрегаты с default’ами (`unique_download_count`, `average_rating`, `review_count`), `created_at` / `updated_at` / опциональный `published_at`. Таблицы `workflows`, `workflow_files`; уникальный `slug`; уникальный `workflow_id` на файле — **один актуальный JSON на workflow** (в комментарии к схеме зафиксировано, что история версий — в object storage при необходимости); FK `ON DELETE CASCADE`. Миграция: [`prisma/migrations/20260329133846_add_workflow_and_workflow_file`](./prisma/migrations/20260329133846_add_workflow_and_workflow_file).

Проверка: [`scripts/workflow-smoke.ts`](./scripts/workflow-smoke.ts) — `npm run db:workflow-smoke` (создание пары Workflow + WorkflowFile, ожидание `P2002` на второй файл с тем же `workflow_id` и на дубликат `slug`).

**Проверки в репозитории:** `npx prisma validate`, `npm run build`, `npm run db:workflow-smoke` и `npm run db:user-smoke` — успешно при настроенном `DATABASE_URL`.

## TASK-007 (done)

Добавлены **WorkflowNode** (PRD §6.4), **Tag** и **WorkflowTag** (PRD §6.5) в [`prisma/schema.prisma`](./prisma/schema.prisma): enum `WorkflowNodeSource` (`derived`, `admin`); таблица `workflow_nodes` с FK на `workflows` и `ON DELETE CASCADE`; `tags` с уникальным `slug`; `workflow_tags` с составным первичным ключом `(workflow_id, tag_id)` и каскадом при удалении workflow или тега. Миграция: [`prisma/migrations/20260401061632_add_workflow_node_tag`](./prisma/migrations/20260401061632_add_workflow_node_tag).

Проверка: `npm run db:workflow-node-tag-smoke` ([`scripts/workflow-node-tag-smoke.ts`](./scripts/workflow-node-tag-smoke.ts)) — создание Tag, связи WorkflowTag, три `WorkflowNode` с разным `sort_order`, выборка `ORDER BY sort_order asc`, ожидание `P2002` на дубликат пары workflow+tag; затем очистка тестовых строк.

**Проверки в репозитории:** `npx prisma validate`, `npm run db:workflow-node-tag-smoke` при настроенном `DATABASE_URL` (локальный PostgreSQL или облако, без Docker).

## TASK-008 (done)

Добавлены **DownloadEvent** (PRD §6.6) и **UniqueDownload** (PRD §6.7) в [`prisma/schema.prisma`](./prisma/schema.prisma): таблицы `download_events` (FK на `workflows` `ON DELETE CASCADE`, на `users` `ON DELETE SET NULL`, поля `ip_hash`, `occurred_at`, `counted_unique` и пр.) и `unique_downloads` (FK аналогично, `first_at`). Уникальность «одна строка на пару (workflow, user) при ненулевом user» и «на (workflow, anon_device_id) при ненулевом anon» задана **частичными уникальными индексами** в SQL; добавлен `CHECK` `unique_downloads_user_xor_anon` — ровно одно из `user_id` / `anon_device_id` не NULL. Миграция: [`prisma/migrations/20260401062522_add_download_event_unique_download`](./prisma/migrations/20260401062522_add_download_event_unique_download).

Проверка: `npm run db:unique-download-smoke` ([`scripts/unique-download-smoke.ts`](./scripts/unique-download-smoke.ts)) — первая `UniqueDownload` по workflow+user, вторая с теми же ключами → `P2002`; то же для anon; попытка записи с обоими ключами → нарушение CHECK (PostgreSQL `23514`).

**Проверки в репозитории:** `npx prisma validate`, `npm run build`, `npm run lint`, `npm run db:unique-download-smoke` при настроенном `DATABASE_URL`.

## TASK-009 (done)

Добавлена модель **Review** (PRD §6.8) в [`prisma/schema.prisma`](./prisma/schema.prisma): `workflow_id` / `user_id` (FK, `ON DELETE CASCADE`), `rating` (int), опциональный `body` (`TEXT`), `created_at` / `updated_at` / `deleted_at` для soft delete. Составной `@@unique` по `(workflow_id, user_id)` **не** используется: уникальность только среди активных строк — **частичный уникальный индекс** `reviews_workflow_user_active_key` в SQL; ограничение `reviews_rating_range` (`rating` 1–5). Миграция: [`prisma/migrations/20260401063547_add_review`](./prisma/migrations/20260401063547_add_review).

Проверка: `npm run db:review-smoke` ([`scripts/review-smoke.ts`](./scripts/review-smoke.ts)) — отзыв с `rating: 3`, второй активный отзыв для той же пары → `P2002`; после `deleted_at` на первом — вторая активная вставка успешна.

**Проверки в репозитории:** `npx prisma validate`, `npm run build`, `npm run db:review-smoke` при настроенном `DATABASE_URL`.

## TASK-010 (done)

Добавлена модель **MediaAsset** (PRD §6.9) в [`prisma/schema.prisma`](./prisma/schema.prisma): enum `MediaAssetKind` (`image`, `video`), `MediaAssetRole` (`input_example`, `output_example`); поля `storage_key`, `byte_size`, `mime_type`, `sort_order`; обязательный FK `workflow_id` на `workflows` с **`ON DELETE CASCADE`** (лимиты по количеству на `(workflow_id, role, kind)` — в приложении, отдельная задача). Таблица `media_assets`. Миграция: [`prisma/migrations/20260401064508_add_media_asset`](./prisma/migrations/20260401064508_add_media_asset).

Проверка: `npm run db:media-asset-smoke` ([`scripts/media-asset-smoke.ts`](./scripts/media-asset-smoke.ts)) — вставка `MediaAsset` для тестового workflow, затем удаление workflow и проверка, что строки в `media_assets` не остались.

**Проверки в репозитории:** `npx prisma validate`, `npm run db:media-asset-smoke` при настроенном `DATABASE_URL`.

## TASK-011 (done)

Добавлена модель **AdminAuditLog** (PRD §6.10) в [`prisma/schema.prisma`](./prisma/schema.prisma): `admin_user_id` → `users` с `ON DELETE RESTRICT`, поля `action`, `entity_type`, `entity_id` (UUID), `payload_json` (JSONB), `created_at`. В комментарии к модели зафиксировано: в `payload_json` не сохранять секреты и токены — редать на записи. Обратная связь `adminAuditLogs` на `User`. Миграция: [`prisma/migrations/20260401065405_add_admin_audit_log`](./prisma/migrations/20260401065405_add_admin_audit_log).

Проверка: `npm run db:admin-audit-log-smoke` ([`scripts/admin-audit-log-smoke.ts`](./scripts/admin-audit-log-smoke.ts)) — вставка аудита для тестового admin-пользователя, выборка по `id`, ожидание `P2003` при несуществующем `admin_user_id`.

**Проверки в репозитории:** `npx prisma validate`, `npm run lint`, `npm run build`, `npm run db:admin-audit-log-smoke` при настроенном `DATABASE_URL`.

## TASK-012 (done)

Реализована **базовая сессия**, привязанная к `User`: подписанный HMAC-SHA256 токен в cookie `workflowhub_session` с **`httpOnly`**, **`SameSite=Lax`**, **`Secure`** только при `NODE_ENV === "production"` (на HTTP в dev флаг не ставится — см. JSDoc в [`lib/session-cookie.ts`](./lib/session-cookie.ts)). Env: обязательный **`SESSION_SECRET`** (≥32 символа), опциональный **`SESSION_MAX_AGE_DAYS`** (дефолт 30) в [`lib/env-parse.ts`](./lib/env-parse.ts); [`.env.example`](./.env.example) обновлён.

**Код:** [`lib/session-cookie.ts`](./lib/session-cookie.ts) (`createSessionToken`, `parseSessionToken`, опции cookie), [`lib/prisma.ts`](./lib/prisma.ts), [`lib/get-session-user.ts`](./lib/get-session-user.ts) (`getSessionUser`), dev-only [`app/api/dev/session/route.ts`](./app/api/dev/session/route.ts) (`POST` по `userId` из БД, `DELETE` — сброс; вне development — 404).

**Проверки:** `npm run lint`, `npm run build` с `DATABASE_URL` и `SESSION_SECRET`; ручные шаги из `tasks.json` — `POST /api/dev/session`, DevTools (флаги cookie), перезапуск браузера при ненулевом `maxAge`. Инструкция для curl/README — в [README.md](README.md) раздел «Dev session cookie».

## TASK-013 (done)

Реализован **вход через Google** (OAuth 2.0 / OIDC, PRD §5.7): `GET /api/auth/google` (state в httpOnly cookie `workflowhub_oauth_state`, редирект на Google), `GET /api/auth/google/callback` (проверка state, обмен `code` на токен через `fetch`, userinfo, `upsert` в `users` с `provider=google`, установка `workflowhub_session` через существующий [`lib/session-cookie.ts`](./lib/session-cookie.ts)). Обмен токенов и userinfo без сторонних OAuth-библиотек: [`lib/auth/google-oauth.ts`](./lib/auth/google-oauth.ts); state: [`lib/auth/oauth-state.ts`](./lib/auth/oauth-state.ts); upsert: [`lib/auth/upsert-google-user.ts`](./lib/auth/upsert-google-user.ts). Страница [`app/login/page.tsx`](./app/login/page.tsx) (английский UI), ссылка с главной; ошибки на `/login?error=…` с фиксированными кодами (`oauth_config`, `oauth_state`, `oauth_failed`) без утечки секретов и сырого ответа провайдера.

**Env (опционально до включения входа):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_BASE_URL` (парная валидация с `AUTH_BASE_URL` при заданных ключах) в [`lib/env-parse.ts`](./lib/env-parse.ts); [`.env.example`](./.env.example), [README.md](README.md).

**Проверки в репозитории:** `npm run lint`, `npm run build` — успешно. Полный цикл из `test_steps` задачи (Google Cloud OAuth client, redirect URI `{AUTH_BASE_URL}/api/auth/google/callback`, ручной flow с `/login`, проверка строки в `users`) выполняется локально при заданных переменных и работающей БД.

## TASK-014 (done)

Реализован **вход через GitHub** по тому же паттерну, что Google: [`lib/auth/github-oauth.ts`](./lib/auth/github-oauth.ts) (authorize, token JSON, `/user` + при необходимости `/user/emails`, стабильный `provider_subject` = `String(github.id)`), [`lib/auth/upsert-github-user.ts`](./lib/auth/upsert-github-user.ts), `GET /api/auth/github` и `GET /api/auth/github/callback` ([`app/api/auth/github/`](./app/api/auth/github/)). Политика учёток: в JSDoc у upsert Google/GitHub — одна и та же почта у разных провайдеров даёт **две отдельные** строки `users`, без автолинковки.

**Env:** `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (парная валидация); при включённом Google и/или GitHub обязателен `AUTH_BASE_URL` — см. [`lib/env-parse.ts`](./lib/env-parse.ts), [`.env.example`](./.env.example). Callback GitHub: `{AUTH_BASE_URL}/api/auth/github/callback`, scopes `read:user user:email`.

**UI:** [`app/login/page.tsx`](./app/login/page.tsx) — кнопки Google и/или GitHub в зависимости от конфигурации.

**Проверки в репозитории:** `npm run lint`, `npm run build` — успешно. Полный цикл из `test_steps` задачи (OAuth App на GitHub, redirect flow, строка в `users` с `provider=github`) — вручную при заданных `GITHUB_*`, `AUTH_BASE_URL` и работающей БД.

## TASK-015 (done)

**Ограничение админ-маршрутов:** доступ `User.role === admin` **или** email в **`ADMIN_EMAIL_ALLOWLIST`** (env, регистр не важен, разделители запятая/перенос строки). Логика в [`lib/auth/admin-access.ts`](./lib/auth/admin-access.ts): `isAdminUser`, `adminRouteGuard` (401 без сессии, 403 с сессией но не админ), `resolveRoleForOAuth` — не понижать существующего `admin` при логине; allowlist поднимает роль до `admin` при upsert. OAuth upsert: [`lib/auth/upsert-google-user.ts`](./lib/auth/upsert-google-user.ts), [`lib/auth/upsert-github-user.ts`](./lib/auth/upsert-github-user.ts). Env: [`lib/env-parse.ts`](./lib/env-parse.ts), [`.env.example`](./.env.example).

**UI:** [`app/admin/layout.tsx`](./app/admin/layout.tsx) вызывает `forbidden()` (Next `experimental.authInterrupts` в [`next.config.ts`](./next.config.ts)), страница [`app/admin/page.tsx`](./app/admin/page.tsx), [`app/forbidden.tsx`](./app/forbidden.tsx).

**API:** `GET /api/admin/me` → 200 `{ ok: true }` только для админа; `POST /api/admin/workflows` — после guard **501** до TASK-018.

**Проверки в репозитории:** `npm run lint`, `npm run build` — успешно. Ручные `test_steps` из `tasks.json`: пользователь `role=user` — `/admin` и `GET /api/admin/me` отказ; `POST /api/admin/workflows` — 403 с сессией или 401 без; под `admin` или allowlist+логин — успех на `GET /api/admin/me` и 501 на `POST`. В development удобно `POST /api/dev/session` с `userId` двух тестовых пользователей из БД.

## TASK-016 (done)

**Парсер ComfyUI workflow JSON (PRD §14 п.2):** стратегия форматов зафиксирована в [`docs/adr/0001-comfy-workflow-json-formats.md`](./docs/adr/0001-comfy-workflow-json-formats.md) — UI-экспорт (`nodes[].type`) и API-граф (`class_type` по ключам нод), порядок и дедупликация типов. Код: [`lib/comfy/parse-workflow-node-types.ts`](./lib/comfy/parse-workflow-node-types.ts) (`parseComfyWorkflowNodeTypesFromString`, `extractComfyWorkflowNodeTypes`, ошибки `ComfyWorkflowJsonSyntaxError` / `ComfyWorkflowShapeError`), [`lib/comfy/replace-derived-workflow-nodes.ts`](./lib/comfy/replace-derived-workflow-nodes.ts) — транзакция `deleteMany` только для `source=derived`, затем `createMany` с `sortOrder`; строки `admin` не трогаются.

**Фикстуры:** [`fixtures/comfy-workflow-api-sample.json`](./fixtures/comfy-workflow-api-sample.json), [`fixtures/comfy-workflow-ui-sample.json`](./fixtures/comfy-workflow-ui-sample.json). **Проверки:** `npm run comfy:parse-smoke` ([`scripts/comfy-workflow-parse-smoke.ts`](./scripts/comfy-workflow-parse-smoke.ts)) — эталонные файлы, ожидаемые типы, битый JSON → syntax error, `{}` → shape error; при заданном `DATABASE_URL` — запись derived в БД и сохранение admin-ноды.

**Репозиторий:** `npm run lint`, `npm run build`, `npm run comfy:parse-smoke` — успешно.

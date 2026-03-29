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

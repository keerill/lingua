# Lingua — Срез 1 (walking skeleton)

Широкий AI-тренажёр английского. **Срез 1** — тонкий сквозной путь через все слои:
логин (Keycloak PKCE) → колода → карточки → очередь повторения → оценка 1–4 →
FSRS пересчитал `due` → событие через **transactional outbox** → Kafka → потребитель,
создающий расписание.

Это учебно-портфолийный проект (distributed systems). Архитектура: микросервисы (NestJS)
+ микрофронты (React 19 + Rspack + Module Federation 2.0), асинхронная коммуникация через
Kafka, auth через Keycloak.

## Стек

| Слой | Технологии |
|------|-----------|
| Монорепо | Nx 22, **pnpm 11** |
| Frontend | React 19.2, React Router 7, TanStack Query 5, Rspack 1.6 + `@module-federation/enhanced` 2.5 |
| Backend | NestJS 11, Node 24 |
| ORM / БД | **Prisma 7** (driver adapter `@prisma/adapter-pg`), PostgreSQL 18 (db-per-service) |
| Шина | Apache Kafka (KRaft), клиент `@confluentinc/kafka-javascript`, transactional outbox |
| Auth | Keycloak 26 (OIDC, PKCE, JWKS-валидация) |
| SRS | `ts-fsrs` 5 |
| Кэш | Redis 7 (зарезервирован) |

## Структура

```
apps/
  shell/           MF host (React) — layout, login-флоу, грузит mfe-learner
  mfe-learner/     MF remote — колоды, карточки, экран повторения
  gateway-bff/     NestJS BFF — публичный REST, агрегация, валидация JWT, PKCE-обмен
  svc-identity/    NestJS — профили (id = Keycloak sub)
  svc-vocabulary/  NestJS — decks/cards, публикует vocabulary.card.created (outbox)
  svc-learning/    NestJS + ts-fsrs — расписания, review_logs, потребитель card.created
  gateway-bff-e2e/ e2e на основной флоу
libs/
  contracts/       DTO + типы Kafka-событий (единый источник истины, TS)
  kafka/           обёртка @confluentinc/kafka-javascript + outbox-релей
  auth/            JWKS-валидация Keycloak, NestJS guard + @CurrentUser + @Roles
infra/docker/      docker-compose.dev.yml, Keycloak realm, init-скрипты, Dockerfile
```

## Предусловия

- **Node 24 LTS** (`.nvmrc` = 24)
- **pnpm 11** — включается через corepack: `corepack enable && corepack prepare pnpm@11.5.2 --activate`
- **Docker** + Docker Compose (Postgres, Redis, Kafka, Keycloak)

## Быстрый старт

```bash
# 1. Зависимости
pnpm install

# 2. Окружение
cp .env.example .env

# 3. Инфраструктура (Postgres + Redis + Kafka KRaft + Keycloak с импортом realm)
docker compose -f infra/docker/docker-compose.dev.yml up -d

# 4. Prisma: сгенерировать клиенты и накатить миграции (db-per-service)
pnpm nx run-many -t prisma-generate          # svc-identity, svc-vocabulary, svc-learning
pnpm nx run svc-identity:prisma-migrate
pnpm nx run svc-vocabulary:prisma-migrate
pnpm nx run svc-learning:prisma-migrate

# 5. Запустить всё (4 сервиса + 2 микрофронта)
pnpm nx run-many -t serve
```

Открыть **http://localhost:4200**, нажать «Log in», войти тестовым пользователем
`learner` / `learner`.

### Порты

| Приложение | URL |
|-----------|-----|
| shell (host) | http://localhost:4200 |
| mfe-learner (remote) | http://localhost:4201 |
| gateway-bff | http://localhost:3000 |
| svc-identity | http://localhost:3101 |
| svc-vocabulary | http://localhost:3102 |
| svc-learning | http://localhost:3103 |
| Keycloak | http://localhost:8080 |
| Postgres | localhost:5432 |
| Kafka | localhost:9092 |
| Redis | localhost:6379 |

## Keycloak

Realm `lingua` импортируется автоматически при `up` (`--import-realm`). В нём:

- **public-client `lingua-shell`** — PKCE (S256), для браузера.
- **confidential-client `lingua-bff`** — секрет `lingua-bff-secret`, обмен кода на BFF.
- роли `learner` / `admin`.
- тестовый пользователь `learner` / `learner`.

Админка Keycloak: http://localhost:8080 (admin / admin). Свой JWT мы **не выпускаем** —
токены даёт Keycloak, сервисы валидируют их по JWKS.

### Auth-флоу (PKCE на BFF)

1. shell → `GET /auth/login` на BFF → редирект в Keycloak (PKCE challenge).
2. Keycloak → `GET /auth/callback` на BFF → обмен кода (confidential client) →
   refresh-токен в **httpOnly cookie**, access-токен возвращается SPA во фрагменте URL.
3. SPA шлёт `Authorization: Bearer <access>` на BFF; при 401 — тихий `POST /auth/refresh`
   (ротация refresh-cookie).

## Публичный API (BFF)

```
POST /decks                {title,langFrom,langTo}     -> Deck
GET  /decks                                            -> Deck[]
POST /decks/:deckId/cards  {term,translation,example?} -> Card
GET  /reviews/queue?limit=20                           -> DueCard[]   (агрегация learning + vocabulary)
POST /reviews/:cardId      {grade:1|2|3|4}             -> NextSchedule (FSRS пересчёт)
```

## Transactional outbox

Доменная запись и факт публикации события пишутся в **одной транзакции** Prisma
(таблица `outbox`). Релей из `libs/kafka` поллит неопубликованные строки, публикует в
Kafka и проставляет `published_at`. Это даёт **at-least-once** доставку без распределённой
транзакции с Kafka — поэтому потребители идемпотентны (дедуп по `eventId`).

События:
- `vocabulary.card.created` → svc-learning создаёт начальное FSRS-расписание.
- `learning.review.completed` → публикуется после повторения (основа будущей петли обратной связи).

## Архитектура

**Макро (системный уровень):** микросервисы (db-per-service) + event-driven через Kafka с
transactional outbox; BFF делает CQRS-lite агрегацию на чтение; auth — Keycloak (OIDC/PKCE,
JWKS). Фронт — Module Federation 2.0 (host `shell` + remote `mfe-learner`).

**NestJS-сервисы — Hexagonal (Ports & Adapters) + DDD tactical**, прагматично по сложности:

```
apps/<svc>/src/
  domain/         сущности, value-objects, доменные сервисы, ports/ (интерфейсы)
  application/    use-cases (зависят только от port-токенов)
  infrastructure/ prisma/ + kafka/ адаптеры (реализуют порты)
  interface/http/ NestJS-контроллеры (primary adapters)
  <svc>.module.ts composition root: { provide: TOKEN, useClass: Adapter }
```

- **svc-learning** — полный гексагон: домен FSRS (`FsrsService`, `Schedule` aggregate),
  порты `ScheduleRepository`/`ReviewOutcomeWriter`, use-cases (CreateInitialSchedule,
  GetReviewQueue, SubmitReview). Транзакция «schedule+log+outbox» инкапсулирована в адаптере.
- **svc-vocabulary** — гексагон полегче: `Deck`/`Card` сущности, порты `DeckRepository`/
  `CardRepository`, use-cases; card+outbox в одной транзакции.
- **svc-identity** — лёгкий (CRUD): `User` + `UserRepository` порт + тонкие use-cases.
- **gateway-bff** — оркестратор без домена: client-порты (`VocabularyPort`/`LearningPort`/
  `IdentityPort`) + HTTP-адаптеры; агрегация очереди — отдельный use-case.

Выгода гексагона видна в тестах: use-cases проверяются с **in-memory адаптерами** без БД
(`submit-review.usecase.spec`, `get-review-queue.usecase.spec`).

**Микрофронты — MVVM + SCSS Modules.** ViewModel-хуки (`model/view-models/`) держат
state/commands/derived через TanStack Query; View-компоненты (`ui/`) — чистое отображение,
стили только через `*.module.scss` (никаких инлайн-стилей).

## Тесты

```bash
pnpm nx run-many -t test     # юниты: contracts, auth, kafka (outbox-релей), FSRS-домен,
                             # SubmitReview/GetReviewQueue use-cases (in-memory адаптеры)
pnpm nx e2e gateway-bff-e2e  # e2e основного флоу через BFF
```

## Заметки по реализации

- **Module Federation = Rspack + MF 2.0** (`@module-federation/enhanced`). Конфиг —
  `apps/{shell,mfe-learner}/rspack.config.cjs`. React/Router/Query — shared singletons.
- **Prisma 7**: generated-клиент в `apps/*/src/generated/prisma` (в `.gitignore`,
  пересоздаётся `prisma generate`), connection string — в `prisma.config.ts`, рантайм —
  через driver adapter `@prisma/adapter-pg`.
- Сервисы в dev запускаются через **SWC** (`node -r @swc-node/register`), build — `tsc`.
  (esbuild/tsx не эмитит decorator metadata, нужный NestJS DI.)
- Внутренний REST между BFF и сервисами; identity передаётся хедером `x-owner-id`
  (BFF — граница доверия после валидации JWT). gRPC — Срез 4.

## Граница среза (НЕ входит в Срез 1)

AI / STT / TTS / WebSocket (Срез 2); Next.js публичный сайт, mfe-speaking/progress/studio,
svc-content/progress/notifications (Срез 3); Kubernetes / Helm / Terraform / OpenTelemetry /
Prometheus / gRPC (Срез 4).

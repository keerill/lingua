Ты — senior full-stack / platform-инженер. Помоги мне собрать **Срез 1 (walking skeleton)**
учебно-портфолийного приложения `Lingua` — широкого AI-тренажёра английского.
Мы строим **по вертикальным срезам**: сейчас только тонкий путь насквозь через все
слои, доведённый до рабочего состояния. Не строй то, что вне Среза 1.

## Контекст архитектуры

- Монорепо на **Nx**. Микросервисы на бэке, микрофронты на фронте.
- Async-коммуникация через **Apache Kafka** с паттерном **transactional outbox**.
- Auth через **Keycloak** (OIDC, access+refresh), сервисы валидируют токены по JWKS.
- database-per-service на **PostgreSQL** (через **Prisma**), кэш — **Redis**.
- Микрофронты — **Rspack + Module Federation 2.0** (`@module-federation/enhanced`).
  ВАЖНО: НЕ Vite-federation и НЕ Next.js+MF. Next.js — только публичный SSR-сайт,
  вне Среза 1.

## Версии (пинь последние стабильные патчи на момент генерации; ориентир — июнь 2026)

- Node.js **24 LTS**, TypeScript 5.x
- Nx **22.x**, NestJS **11.x**, Prisma **6.x**
- React **19.2.x**, React Router **7.x**, TanStack Query **5.x**
- Rspack 1.x + `@module-federation/enhanced` (MF 2.0)
- Kafka-клиент: **`@confluentinc/kafka-javascript`** (официальный). НЕ KafkaJS —
  он заброшен. НЕ используй встроенный `@nestjs/microservices` Kafka-транспорт
  (он тащит KafkaJS); подключай Kafka напрямую в общей либе.
- SRS: **`ts-fsrs`**. Keycloak **26.x**, PostgreSQL 17/18, Redis 7.

## Что построить в Срезе 1

### Монорепо (Nx)

```
apps/
  shell/           # Rspack MF host (React 19)
  mfe-learner/     # Rspack MF remote: колоды + карточки + повторение
  gateway-bff/     # NestJS BFF (REST к фронту, агрегация сервисов)
  svc-identity/    # NestJS + интеграция с Keycloak
  svc-vocabulary/  # NestJS (decks, cards)
  svc-learning/    # NestJS + ts-fsrs (расписание, логи повторений)
libs/
  contracts/       # общие TS-типы DTO + типы Kafka-событий (единый источник истины)
  kafka/           # обёртка над @confluentinc/kafka-javascript + outbox-релей
  auth/            # JWKS-валидация токенов Keycloak, NestJS guards
infra/docker/      # docker-compose.dev.yml + Dockerfile'ы
```

### Данные (db-per-service, Prisma-схема на каждый сервис)

- **identity:** `users(id=keycloak sub, email, display_name, roles, created_at)`; upsert профиля при первом входе.
- **vocabulary:** `decks(id, owner_id, title, lang_from, lang_to, created_at)`, `cards(id, deck_id, term, translation, example, created_at)`.
- **learning:** `card_schedules(user_id, card_id, stability, difficulty, due, reps, lapses, state, last_review)`, `review_logs(id, user_id, card_id, grade, reviewed_at, elapsed)`.

### API (через BFF, REST)

```
POST /decks                  { title, langFrom, langTo }        -> Deck
GET  /decks                                                     -> Deck[]
POST /decks/:deckId/cards    { term, translation, example? }     -> Card
GET  /reviews/queue?limit=20                                    -> DueCard[]   (агрегация cards + due<=now)
POST /reviews/:cardId        { grade: 1|2|3|4 }                  -> NextSchedule (FSRS пересчёт через ts-fsrs)
```

### События Kafka (схемы — в libs/contracts)

- `vocabulary.card.created` → svc-learning создаёт начальное FSRS-расписание.
- `learning.review.completed` → публикуется после повторения (на будущее — петля обратной связи; сейчас достаточно потребителя-логгера).
- Публикация строго через **outbox**: доменная запись + строка `outbox` в одной транзакции; релей из `libs/kafka` дочитывает и публикует.

### Auth

- Keycloak realm `lingua`: public-client (PKCE) для shell, confidential-client для BFF, роли `learner`/`admin`.
- Свой JWT НЕ выпускать — токены даёт Keycloak. BFF валидирует по JWKS. `access` короткий, `refresh` в httpOnly cookie с ротацией.

### Микрофронты

- `shell` — host: загружает `mfe-learner` как remote через MF 2.0 (манифест, шаринг React/типов), общий layout, логин-флоу (PKCE), React Router.
- `mfe-learner` — экран колод, добавление карточек, экран повторения (показ карточки → оценка 1–4 → следующий показ). TanStack Query к BFF.

## Definition of Done

- `docker-compose -f infra/docker/docker-compose.dev.yml up` поднимает Postgres, Redis, Kafka (KRaft), Keycloak (с импортом realm).
- `nx run-many -t serve` запускает все приложения Среза 1.
- Сквозной флоу работает: логин → колода → карточки → очередь → оценка → FSRS пересчитал due → событие прошло через outbox → Kafka → потребитель.
- `libs/contracts` импортируется и фронтом, и сервисами (одни типы).
- Юнит-тесты (FSRS-логика, outbox-релей) + e2e на основной флоу.
- Корневой README: предусловия, команды запуска, как создать realm/clients в Keycloak, как прогнать миграции Prisma.

## Явные НЕ-цели (НЕ делай в Срезе 1)

- Никакого AI / STT / TTS / WebSocket (Срез 2).
- Никакого Next.js-сайта, mfe-speaking/progress/studio, svc-content/progress/notifications/ai/speech.
- Никакого Kubernetes / Helm / Terraform / OpenTelemetry / Prometheus / gRPC (флекс, Срез 4).

## Как работай

1. Сначала покажи **план файлов и порядок шагов**, затем реализуй по шагам.
2. Объясняй ключевые решения кратко (особенно outbox, MF host/remote конфиг, Keycloak-интеграцию, FSRS).
3. Давай рабочие команды Nx-генераторов и итоговые команды запуска.
4. Не выдавай заглушки вместо логики там, где она нужна по DoD.
5. Если упираешься в выбор без однозначного ответа — задай один уточняющий вопрос, не угадывай молча.

Начни с плана файлов и порядка шагов.

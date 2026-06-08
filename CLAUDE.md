# CLAUDE.md — Lingua

> Этот файл Claude Code читает автоматически в начале каждого сеанса.
> Держи его в корне репозитория и обновляй статус срезов по мере прогресса.

## Что это
`Lingua` — широкий AI-тренажёр английского: база (карточки/словарь/SRS) + разговорная
практика с AI в реальном времени + петля обратной связи (ошибки из разговора →
в колоду повторения). Архитектура: микросервисы + микрофронты. Цель — портфолио
(показать distributed systems) и потенциальный продукт.

## Принципы
- Строим **по вертикальным срезам**: один сквозной путь до рабочего состояния, потом следующий. Не забегать вперёд.
- Никаких заглушек там, где спецификация требует логики.
- Инфра — слоями поверх рабочего скелета (compose → потом k8s/observability).
- Polyglot осознанно: TypeScript — продуктовые сервисы, Python — только AI/аудио.

## Стек (пинить свежие стабильные патчи; ориентир — июнь 2026)
- Монорепо: **Nx 22.x**.
- Frontend: **React 19.2** + **Rspack** + **Module Federation 2.0** (`@module-federation/enhanced`); **React Router 7**, **TanStack Query 5**, **Tailwind 4**.
- Публичный сайт: **Next.js 16** (App Router) — ОТДЕЛЬНО, НЕ через MF.
- Backend: **NestJS 11** (продуктовые сервисы), **Python 3.13/3.14 + FastAPI** (AI/Speech).
- Node **24 LTS**; ORM **Prisma 6**; SRS — **ts-fsrs**.
- Данные: **PostgreSQL 17/18** (db-per-service), **Redis 7**, **pgvector**, **MinIO** (аудио).
- Шина: **Apache Kafka** + **transactional outbox**; клиент **`@confluentinc/kafka-javascript`** (НЕ KafkaJS; НЕ встроенный Kafka-транспорт NestJS).
- Auth: **Keycloak 26.x** (OIDC, access+refresh; свой JWT не выпускаем; валидация по JWKS).
- Флекс (Срез 4): **Kubernetes 1.36** + Helm, **OpenTelemetry**, **Prometheus/Grafana/Loki**, **gRPC** (внутр.), **GitHub Actions** (`nx affected`), **Terraform**.

## Жёсткие правила
- **Module Federation = Rspack + MF 2.0.** НЕ Vite-federation, НЕ Next.js+MF (поддержка сворачивается). Next.js — только публичный SSR-слой.
- **gRPC — только внутренний** (из браузера напрямую нельзя). К фронту: REST/GraphQL + WebSocket.
- **Контракты — единый источник истины** в `libs/contracts`; события генерировать из Avro/Protobuf для TS и Python, не дублировать.
- Публикация в Kafka — только через outbox.

## Структура (целевая)
```
apps/  web-public(Next) shell mfe-learner mfe-speaking mfe-progress mfe-studio
       gateway-bff svc-identity svc-content svc-vocabulary svc-learning
       svc-progress svc-notifications svc-ai-dialog(py) svc-speech(py)
libs/  contracts kafka auth observability ui
infra/ docker helm terraform
```

## Статус срезов  — ОБНОВЛЯТЬ ПО ХОДУ
- [ ] Срез 1 — walking skeleton (identity, vocabulary, learning, gateway-bff, shell, mfe-learner; Kafka+outbox; Keycloak; compose)
- [ ] Срез 2 — AI-разговор + петля (svc-ai-dialog, svc-speech, mfe-speaking; WebSocket; MinIO)
- [ ] Срез 3 — content, progress, notifications, mfe-progress, mfe-studio, web-public(Next)
- [ ] Срез 4a — Docker + Kubernetes + Helm
- [ ] Срез 4b — OpenTelemetry + Prometheus + Grafana + Loki
- [ ] Срез 4c — gRPC + Schema Registry
- [ ] Срез 4d — CI/CD (GitHub Actions) + Terraform

## Как работать с этим репозиторием
1. Прочитать этот файл и текущее состояние репозитория.
2. Выполнять промпт из `prompts/slice*.md`, указанный в сообщении.
3. Сначала показать план файлов и шагов, дождаться подтверждения.
4. Прогонять тесты и сборку; при неоднозначном выборе — один уточняющий вопрос, без молчаливых догадок.

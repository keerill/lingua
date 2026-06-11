# 10 — AI & Speech

Lingua's conversational practice has two backend services:

- **`svc-ai-dialog`** runs the *conversation*: it takes what the learner said, asks a
  large language model (LLM) for a reply, streams that reply back token-by-token, and
  detects mistakes in the learner's English.
- **`svc-speech`** runs the *audio* edges of the turn: speech-to-text (STT) to hear the
  learner, text-to-speech (TTS) to speak the AI reply, and a pronunciation score.

The defining design choice here is that **every external AI engine is a hexagonal port
with a deterministic fake adapter wired in by default**. The whole speaking flow — and
every test — runs offline with zero API keys. Real engines (Anthropic, Whisper, Piper)
are opt-in via environment variables. This page explains the ports, the fakes, the real
adapters, and the end-to-end speaking-turn pipeline.

## What is it

A few terms, from first principles:

- **LLM (Large Language Model).** A model that, given a system prompt + conversation
  history + the latest user message, predicts a natural-language reply. Lingua uses it as
  the "conversation partner" in a roleplay scenario (ordering food, a job interview, etc.).
- **Streaming.** The LLM emits its answer as a sequence of small text chunks ("tokens")
  rather than one blob at the end. Streaming lets the UI show words appearing live, which
  matters for a real-time chat feel. In code, a stream is modelled as an
  `AsyncIterable<string>`.
- **STT (Speech-to-Text).** Turns a recorded audio clip into a text transcript plus a
  confidence number. Lingua's default real engine is **Whisper** (OpenAI's open speech
  model) run locally through `@huggingface/transformers`.
- **TTS (Text-to-Speech).** Turns text into a `.wav` audio buffer. The default real engine
  is **Piper**, a fast local neural TTS invoked as a CLI.
- **Pronunciation scoring.** A 0–100 score (overall + per word) describing how clearly the
  learner spoke. Lingua's scorer is a transparent heuristic over the STT confidence — not a
  real phoneme model — which is enough to drive the UI without a heavyweight dependency.

### Ports & adapters (why fakes by default)

Each AI capability is defined as a **port** — a tiny TypeScript interface and a DI token —
in the service's `domain/ports/`. The use-cases depend only on the port, never on a vendor
SDK. The concrete engine is an **adapter** in `infrastructure/`, chosen at startup by a
factory in the module (the composition root).

The ports are deliberately minimal:

```ts
// svc-ai-dialog
interface LlmProvider { streamReply(turn: LlmTurn): AsyncIterable<string>; }
interface MistakeDetector { detect(userText: string): Mistake[]; }

// svc-speech
interface SttProvider { transcribe(audio: Buffer, mime: string): Promise<Transcript>; }
interface TtsProvider { synthesize(text: string, voice?: string): Promise<Buffer>; }
interface PronunciationScorer { score(t: Transcript, ref?: string): Pronunciation; }
```

Why ship fakes as the *default* rather than the real engines? Three reasons:

1. **Offline & free.** A new contributor can `git clone`, run the whole speaking flow in the
   browser, and run the test suite — with no Anthropic key, no model downloads, no GPUs.
2. **Determinism.** The fakes return fixed, predictable output, so tests can assert exact
   behaviour (e.g. that a known sentence produces a known mistake event). A real LLM's output
   is non-deterministic and would make tests flaky.
3. **One-line swap.** Going real is a config change, not a code change: set
   `LLM_PROVIDER=anthropic` (etc.) in the environment. The factories `require()` the heavy
   adapter only when selected, so the SDK/model code is never even loaded in fake mode.

## How Lingua uses it

### The speaking-turn pipeline

A single conversation turn flows: **audio → STT → LLM (streaming) → TTS → mistake
detection → feedback-loop event**. The browser talks WebSocket to `gateway-bff`, which
orchestrates the two services. The orchestration lives in
[`run-speaking-turn.usecase.ts`](../apps/gateway-bff/src/application/run-speaking-turn.usecase.ts):

1. **STT.** The recorded audio buffer goes to `svc-speech` `POST /stt`. The
   `TranscribeUseCase` calls the STT port, then the pronunciation scorer, and returns
   `{ transcript, confidence, pronunciation }`. The gateway immediately emits a `transcript`
   frame and a `pronunciation` frame to the browser.
2. **LLM (streaming).** The transcript becomes the `userText` sent to `svc-ai-dialog`
   `POST /dialog/turn`. There the [`RunTurnUseCase`](../apps/svc-ai-dialog/src/application/run-turn.usecase.ts)
   loads the scenario's system prompt and the session history, then yields LLM tokens. The
   gateway relays each token as an `ai-token` frame, so the reply appears word-by-word in the
   UI, followed by an `ai-done` frame.
3. **TTS.** If the AI produced text, the gateway calls `svc-speech` `POST /tts`. The
   [`SynthesizeUseCase`](../apps/svc-speech/src/application/synthesize.usecase.ts) renders a
   `.wav`, stores it in MinIO, and returns a public URL — emitted as an `ai-audio` frame the
   browser can play.
4. **Mistake detection + feedback loop.** Back inside `RunTurnUseCase`, the
   `MistakeDetector` runs over the learner's `userText`. If it finds mistakes, the use-case
   builds a `speaking.mistake.detected` event and persists it **in the same transaction** as
   the dialog turn, via the transactional outbox (see [05 — Messaging / Kafka](./05-messaging-kafka.md)).
   That event is what closes Lingua's learning loop: `svc-vocabulary` seeds a "Speaking
   practice" deck and `svc-learning` makes those cards due now.

### Mistake detection (heuristic)

The default detector,
[`HeuristicDetector`](../apps/svc-ai-dialog/src/infrastructure/detect/heuristic-detector.ts),
is rule-based, not an LLM. It tokenizes the sentence and checks a handful of curated patterns:

- **Bad irregular forms** — `goed → went`, `forgetted → forgot`, `buyed → bought`, ...
- **Uncountable/plural vocab slips** — `informations → information`, `advices → advice`,
  `peoples → people`, `fly → flight`.
- **Past-time context** — if the sentence contains `yesterday`/`ago`, base verbs like `go`,
  `eat`, `is` are flagged toward their past forms (`went`, `ate`, `was`).
- **Subject–verb agreement** — `he/she/it don't → doesn't`, and `I/you/we/they doesn't →
  don't`.

Each hit becomes a `Mistake { term, kind, context, translation/hint }`. Keeping detection
deterministic means the loop is testable and the fake STT can return sentences engineered to
trigger known mistakes.

### Pronunciation scoring (heuristic)

[`HeuristicScorer`](../apps/svc-speech/src/infrastructure/score/heuristic-scorer.ts) derives
an overall score by clamping the transcript confidence to 0–1 and scaling to 0–100. Per-word
scores spread deterministically around that overall (a small offset computed from the word's
character codes), so the UI gets a believable per-word breakdown without a real acoustic
model. This is intentionally a placeholder seam: a real phoneme-alignment scorer would just be
another `PronunciationScorer` adapter.

### Audio storage (MinIO)

Synthesized `.wav` files are written to **MinIO** (an S3-compatible object store) by
[`MinioAudioStore`](../apps/svc-speech/src/infrastructure/store/minio-audio.store.ts). The
object key is content-addressed (SHA-1 of the bytes), the bucket is auto-created, and a public
URL is returned so the browser can stream the audio directly.

### The real adapters

| Capability | Port | Fake (default) | Real (opt-in) |
|---|---|---|---|
| LLM | `LlmProvider` | [`FakeLlmAdapter`](../apps/svc-ai-dialog/src/infrastructure/llm/fake-llm.adapter.ts) — echoes a canned encouraging reply, streamed word-by-word | [`AnthropicLlmAdapter`](../apps/svc-ai-dialog/src/infrastructure/llm/anthropic-llm.adapter.ts) — `@anthropic-ai/sdk`, `messages.stream()`, emits `text_delta` chunks |
| STT | `SttProvider` | [`FakeSttAdapter`](../apps/svc-speech/src/infrastructure/stt/fake-stt.adapter.ts) — returns one of a few fixed utterances (some with deliberate mistakes) | [`TransformersSttAdapter`](../apps/svc-speech/src/infrastructure/stt/transformers-stt.adapter.ts) — Whisper via `@huggingface/transformers`, lazily imported on first use |
| TTS | `TtsProvider` | [`FakeTtsAdapter`](../apps/svc-speech/src/infrastructure/tts/fake-tts.adapter.ts) — synthesizes a plain sine-wave `.wav` sized to the text | [`PiperTtsAdapter`](../apps/svc-speech/src/infrastructure/tts/piper-tts.adapter.ts) — spawns the `piper` CLI and captures its `.wav` on stdout |

The **Anthropic** adapter is the production LLM path: it maps the dialog history into
`MessageParam[]`, sends the scenario's `systemPrompt` as the system message, and streams
`content_block_delta` / `text_delta` events straight into the use-case's token stream. The
default model is `claude-opus-4-8` (override with `ANTHROPIC_MODEL`).

The selection happens in the module factories — see
[`ai-dialog.module.ts`](../apps/svc-ai-dialog/src/ai-dialog.module.ts) (`llmFactory`) and
[`speech.module.ts`](../apps/svc-speech/src/speech.module.ts) (`sttFactory`, `ttsFactory`).
Each factory reads the `*_PROVIDER` env var, lazily `require()`s the heavy adapter only when
selected, and otherwise returns the fake. `llmFactory` also fails fast if
`LLM_PROVIDER=anthropic` but `ANTHROPIC_API_KEY` is missing.

### Environment variables

From [`.env.example`](../.env.example):

```bash
# --- AI providers (default to deterministic fakes; everything runs offline) ---
#   To go real:  LLM_PROVIDER=anthropic  STT_PROVIDER=transformers  TTS_PROVIDER=piper
LLM_PROVIDER=fake
STT_PROVIDER=fake
TTS_PROVIDER=fake

# Anthropic (used only when LLM_PROVIDER=anthropic)
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8

# Transformers.js Whisper (used only when STT_PROVIDER=transformers)
WHISPER_MODEL=Xenova/whisper-tiny.en

# Piper voice (used only when TTS_PROVIDER=piper; requires the `piper` CLI on PATH)
PIPER_VOICE=en_US-lessac-medium

# --- MinIO (audio object store) ---
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=lingua-audio
MINIO_PUBLIC_URL=http://localhost:9000
```

Notes:

- **Anthropic** needs a real key; nothing else is required.
- **Whisper** (`transformers`) downloads and caches the model (`Xenova/whisper-tiny.en` by
  default) on first transcription — no key, but a one-time download.
- **Piper** must be installed as a binary on `PATH`; choose a voice with `PIPER_VOICE`.

## Key files

- [`apps/svc-ai-dialog/src/ai-dialog.module.ts`](../apps/svc-ai-dialog/src/ai-dialog.module.ts) — composition root; `llmFactory` selects fake vs Anthropic.
- [`apps/svc-ai-dialog/src/domain/ports/llm.provider.ts`](../apps/svc-ai-dialog/src/domain/ports/llm.provider.ts) — the streaming LLM port.
- [`apps/svc-ai-dialog/src/infrastructure/llm/`](../apps/svc-ai-dialog/src/infrastructure/llm) — `fake-llm.adapter.ts`, `anthropic-llm.adapter.ts`.
- [`apps/svc-ai-dialog/src/application/run-turn.usecase.ts`](../apps/svc-ai-dialog/src/application/run-turn.usecase.ts) — orchestrates LLM stream + mistake detection + outbox event.
- [`apps/svc-ai-dialog/src/infrastructure/detect/heuristic-detector.ts`](../apps/svc-ai-dialog/src/infrastructure/detect/heuristic-detector.ts) — rule-based mistake detector.
- [`apps/svc-speech/src/speech.module.ts`](../apps/svc-speech/src/speech.module.ts) — composition root; `sttFactory`/`ttsFactory`.
- [`apps/svc-speech/src/domain/ports/`](../apps/svc-speech/src/domain/ports) — `stt.provider.ts`, `tts.provider.ts`, `pronunciation.scorer.ts`, `audio.store.ts`.
- [`apps/svc-speech/src/infrastructure/`](../apps/svc-speech/src/infrastructure) — `stt/`, `tts/`, `score/heuristic-scorer.ts`, `store/minio-audio.store.ts`.
- [`apps/gateway-bff/src/application/run-speaking-turn.usecase.ts`](../apps/gateway-bff/src/application/run-speaking-turn.usecase.ts) — the cross-service turn orchestration.

## See it in action

Bring up the dev infra and the two services (defaults = fakes, so no keys needed):

```bash
# infra (Postgres, Kafka, MinIO, ...)
docker compose -f infra/docker/docker-compose.dev.yml up -d

# the two AI services
pnpm nx serve svc-ai-dialog   # http://localhost:3104
pnpm nx serve svc-speech      # http://localhost:3105
```

List the roleplay scenarios:

```bash
curl http://localhost:3104/scenarios
```

Stream an LLM turn (watch the reply arrive token-by-token):

```bash
curl -N -X POST http://localhost:3104/dialog/turn \
  -H 'content-type: application/json' \
  -d '{"sessionId":"s1","userId":"u1","scenario":"cafe",
       "userText":"Yesterday I go to the airport and I miss my fly."}'
```

That sentence trips the heuristic detector (`go`→`went`, `fly`→`flight`), so a
`speaking.mistake.detected` event lands in the outbox and flows through Kafka to seed a
review card.

Synthesize speech (returns a MinIO URL) and transcribe an audio file:

```bash
curl -X POST http://localhost:3105/tts \
  -H 'content-type: application/json' \
  -d '{"text":"Hello, how can I help you today?"}'

curl -X POST http://localhost:3105/stt -F audio=@clip.wav
```

To use the real engines, set the env vars above and restart:

```bash
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-... pnpm nx serve svc-ai-dialog
STT_PROVIDER=transformers TTS_PROVIDER=piper pnpm nx serve svc-speech
```

Run the unit tests (fakes only, fully offline):

```bash
pnpm nx test svc-ai-dialog   # includes run-turn + mistake-detector specs
pnpm nx test svc-speech      # includes STT/TTS/scorer specs
```

## Related

- [01 — Architecture](./01-architecture.md) — hexagonal services and the overall topology.
- [03 — Backend (NestJS)](./03-backend-nestjs.md) — ports/adapters and composition roots.
- [05 — Messaging / Kafka](./05-messaging-kafka.md) — the outbox and the `speaking.mistake.detected` loop.
- [08 — Frontend / MFE](./08-frontend-mfe.md) — `mfe-speaking`, the WebSocket UI.
- [13 — Observability](./13-observability.md) — how a speaking turn becomes one end-to-end trace.

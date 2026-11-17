# Marginalia — AI Whiteboard Tutor

A chat-first tutor that turns a question into an approximately two-minute visual lesson. Watch diagrams unfold as the tutor speaks, pause to draw a note, jump between explanation steps, and ask contextual follow-up questions.

Built for the [Braynix Studios assignment](https://github.com/Braynix-Studios/ai-whiteboard-tutor-assignment).

## Links

- Source: https://github.com/Devesh36/marginalia-ai-tutor
- Live demo: https://marginalia-ai-tutor.vercel.app
- Local Codex app: http://127.0.0.1:3000

The public app uses server-side Gemini for live generation and follow-up questions. Local Codex remains available for loopback development. No API key is required from visitors.

See [Gemini deployment verification](docs/gemini-verification.md) for tested flows, credential handling, and observed provider limits.

## Features

- Real AI lesson generation using **Gemini** or a **local, signed-in Codex CLI**.
- Four or five concept-specific whiteboard scenes with progressively revealed shapes, arrows, labels, equations, and highlights.
- Spoken narration through the browser's Web Speech API, with always-visible captions.
- Play, pause, resume, step-based seek, chapter navigation, restart, replay, and playback speed.
- Drawing tools with three ink colors, undo, and clear. Drawing pauses the tutor.
- Contextual AI follow-up answers, a comprehension question, and clickable lesson notes.
- Responsive layout, labeled controls, reduced-motion support, and an explicit captions-only mode.
- A clearly labeled **authored sample** for checking playback without an AI provider. It is never passed off as generated content.

## Run locally with Codex

Prerequisites: Node.js 22.13 or newer, npm, and the current [Codex CLI](https://developers.openai.com/codex/cli/) installed and signed in. The integration was tested with Codex CLI 0.164.0. Older versions may not support the isolation flags.

```sh
npm ci
cp .env.example .env.local
codex login
npm run dev
```

Open **http://127.0.0.1:3000**. Choose **Local Codex**, enter a topic, and generate a lesson. The CLI uses your existing login and allowance. Generation can take up to three minutes; follow-up answers are usually quicker. No OpenAI API key is needed for this local mode.

The development server binds to loopback. Do not expose or tunnel the local Codex service to the public internet. The application rejects Codex on non-loopback request URLs and on Vercel.

## Run with Gemini

For hidden key entry in your Terminal, run:

```sh
python3 scripts/setup-gemini.py
```

This writes the key to ignored `.env.local` with owner-only permissions and selects Gemini. The key is not printed or passed as a command argument. You can also edit `.env.local` directly:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your_server_side_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

Restart the development server. Gemini is also available in the provider selector when its key is configured. Never use a `NEXT_PUBLIC_` prefix for the key. Never commit `.env.local`.

The default is `gemini-3.5-flash-lite`. The model remains configurable. When using the older Gemini 2.5 Flash family, the server disables automatic thinking to reserve the response budget for lesson JSON. The provider schema stays compact to avoid Gemini's schema-complexity limit; server-side Zod validation still checks sizes, diagram references, geometry, narration length, and quiz choices.

| Variable         | Purpose                                                                  |
| ---------------- | ------------------------------------------------------------------------ |
| `AI_PROVIDER`    | Default provider: `codex` locally or `gemini` for hosting                |
| `GEMINI_API_KEY` | Server-only Google AI API credential                                     |
| `GEMINI_MODEL`   | Model with structured JSON output; defaults to `gemini-3.5-flash-lite`   |
| `CODEX_BIN`      | Optional local Codex executable path; otherwise resolves `codex` on PATH |

## Architecture

```text
Topic → POST /api/lesson → provider → structured JSON → Zod validation
                                              ↖ one bounded repair pass
         ↓
  Lesson scenes and beats → LessonPlayer → browser speech
                                     ↓ utterance start/end
                         reconstructed SVG board + captions

Question + lesson + recent conversation → POST /api/followup → provider → answer
```

**Stack:** Next.js App Router, React, TypeScript, Zod, SVG, Web Speech API. No database is required. Lesson and chat state live in memory in the browser; reloading starts a fresh session.

### Synchronization and seeking

Every scene contains a collection of visual elements and narration beats. Each beat reveals element IDs and focuses the elements being discussed. The board state is reconstructed from all reveals through the selected beat, so seeking backward or forward cannot leave stale elements behind. Changing chapters clears the prior scene.

`LessonPlayer` is a framework-independent state machine. **The narration is the playback clock**: the board switches at the start of a beat, and the speech engine's `end` event advances to the next beat. A generation token invalidates callbacks from canceled speech. Pause/resume operates on the current utterance. Seek cancels that utterance and starts the selected beat when playback is active; seeking while stopped stays stopped. Restart returns to step one and waits for play. Changing speed restarts the current beat.

Seeking intentionally snaps to explanation steps, rather than arbitrary audio timestamps. The UI shows approximate elapsed/total time from word counts, refined with speech boundary events. Device voices vary in speed; this estimated time is **not** used to advance the narrated board. Captions-only mode instead uses an explicit reading timer. Hiding the page pauses playback.

### AI and validation

Both providers return the same JSON structure. The prompt asks for 250–290 spoken words; validation accepts 200–380, bounded scenes/elements, valid geometry, unique IDs, valid reveal/focus references, and a three-choice quiz. Invalid output gets one repair attempt inside an overall request deadline. Errors remain visible and the learner's input is preserved for retry.

The Gemini adapter calls the Google API on the server with structured output. The local Codex adapter launches a child process with an argument array and sends the prompt over stdin; learner text is never interpolated into shell commands. Each request uses an empty temporary working directory, read-only sandboxing, ephemeral output, ignored personal configuration/rules, and disabled shell, browser, app, plugin, memory, and agent tools. Temporary schema/output files are removed afterward. The app does not copy or expose CLI credentials.

### Source map

| File                            | Responsibility                                              |
| ------------------------------- | ----------------------------------------------------------- |
| `app/page.tsx`                  | Topic input, chat, provider selection, request cancellation |
| `components/lesson-stage.tsx`   | Chapters, player controls, captions, quiz, transcript       |
| `components/whiteboard.tsx`     | SVG elements and pointer-based annotations                  |
| `lib/lesson.ts`                 | Data contract, validation, timeline, board reconstruction   |
| `lib/player.ts`                 | Narration-driven player and speech/captions adapters        |
| `lib/server/ai.ts`              | Gemini and local Codex adapters                             |
| `lib/server/generate-lesson.ts` | Validated generation and one bounded repair                 |
| `lib/server/http.ts`            | Payload limits, same-origin check, request throttling       |
| `lib/sample.ts`                 | Explicitly labeled authored playback example                |

## Tests and verification

```sh
npm test
npm run typecheck
npm run build
```

The tests exercise real state transitions with a fake voice transport: pause/resume, narration completion, forward/backward seek, stale callbacks, restart, replay, speed changes, disposal, and an end event racing with pause. Additional tests cover malformed lesson data, payload sizes, same-origin checks, local-provider restrictions, concurrency, and bounded repair.

An optional live Codex smoke test generates an actual lesson and saves ignored diagnostic output:

```sh
node --env-file=.env.local --import tsx scripts/smoke-local.ts
```

It uses the CLI account's allowance. Mocked tests do not prove provider availability. Live Gemini verification requires a configured key.

With the local server running, the live API regression checks generate fractions and supply-and-demand lessons and ask two contextual follow-ups for each:

```sh
npm run test:local
# Rerun one topic:
npm run test:local -- supply-demand
# Test Gemini locally after configuring the key:
TEST_PROVIDER=gemini npm run test:local
# Test the deployed application's server-side Gemini configuration:
TEST_PROVIDER=gemini TEST_BASE_URL=https://marginalia-ai-tutor.vercel.app npm run test:local
```

Results and generated lessons are saved under ignored `outputs/e2e/`. These checks use real Codex requests; browser voice, drawing, and layout checks are manual. See [local verification notes](docs/local-verification.md) for the tested flows and fixes.

## Deploy to Vercel

Import this repository as a **Next.js** project. Set these production environment variables in Vercel:

- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY` (secret)
- `GEMINI_MODEL=gemini-3.5-flash-lite`

Deploy, then verify a new topic and a follow-up from the public URL. The public application must not rely on a local Codex process. Without the Gemini key the deployed app can play the labeled sample, but live generation shows a setup error; that state is **not a complete assignment submission**.

For a local production build:

```sh
npm run build
npm start
```

## Limitations and tradeoffs

- Narration quality and pause/resume support depend on the browser/OS voice engine. Current desktop browsers are recommended. Captions mode is available if speech fails.
- The duration is approximate and seeking is step-based. This is not a rendered video or an audio file with sample-accurate timestamps.
- Generated explanations and diagram layouts can contain mistakes; validation checks structure, not factual correctness or every visual overlap.
- Annotations are temporary and reset when changing chapters. Lessons, chats, and drawings are not persisted after reload.
- Request throttling (8 per minute per observed client, 3 concurrent) is in-process and best effort; it does not provide a distributed spending cap across serverless instances. Configure provider quotas and hosting-level rate limits before a larger public rollout.
- Local Codex is for the owner's loopback development session. It is deliberately unavailable in the Vercel deployment.
- English narration only. No account system, external content retrieval, or durable lesson history.

## Submission status

The source repository and live Gemini demo are public. The Braynix Studios Google Form was submitted successfully on 17 November 2026 with both links, implementation details, AI-tool disclosure, and known limitations.

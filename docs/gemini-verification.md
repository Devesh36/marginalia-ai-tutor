# Gemini verification — 17 November 2026

Live application: https://marginalia-ai-tutor.vercel.app

The deployment uses `gemini-3.5-flash-lite` through the server-side Gemini API. Local Codex remains available on loopback; the public status endpoint reports Codex unavailable and Gemini available.

## Credential handling

- The local key lives only in ignored `.env.local`, with file permissions `600`.
- The production key was sent to Vercel through standard input and stored as a sensitive production environment variable.
- Neither the key nor an environment file was committed. A scan of staged source and browser assets found no occurrence of the actual key.
- The public HTML, status response, and seven loaded JavaScript assets were also scanned; none contained the key.

## Successful live checks

| Environment    | Topic             | Observed result                                                                                                                                                                                                                                                     |
| -------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Gemini   | Fractions         | Valid lesson, 11 steps, approximately 1:41 narration. Generation took 10.5 seconds; two follow-ups took 1.4 and 1.7 seconds. The second reused the first explanation with pizzas.                                                                                   |
| Local Gemini   | Supply and demand | Valid lesson, 15 steps, approximately 1:49 narration. Generation took 13.5 seconds; both follow-ups completed. A terminology issue in an answer prompted a clarification instruction; its retest correctly distinguished a supply shift from movement along demand. |
| Public API     | Fractions         | A valid lesson was generated in 13.3 seconds. A subsequent follow-up encountered an upstream error; this particular runner attempt did not fully pass.                                                                                                              |
| Public browser | Binary search     | Generated a five-chapter, 15-step lesson. Real speech advanced the board and captions; pause and chapter/step seeking worked. A follow-up correctly explained that absent targets leave an empty search range.                                                      |

These are observed examples, not a guarantee that every generated explanation is correct. Narration duration is an estimate, and provider latency varies.

## Integration fixes and limits

- Gemini 3.8 requests failed or timed out during testing. Gemini 2.5 Flash worked but reached this project's reported 20-request daily free-tier limit. The older 2.5 Flash-Lite endpoint returned a migration response naming 3.5 Flash-Lite, which passed live checks.
- A schema with bounds on every nested array/number exceeded Gemini's serving complexity limit. The compact schema now supplies clear field descriptions and exactly three quiz choices, while Zod retains the full application validation.
- Shorter summary instructions resolved repeated overlong summaries. The older 2.5 Flash family uses a zero thinking budget to reserve output for lesson JSON; other configured models retain their defaults.
- Temporary HTTP 500/502/503/504 failures receive at most two retries, with short backoff and the same overall request deadline. Quota and credential failures are not retried. Model-unavailable, output-limit, and quota failures have explicit user-facing errors.
- Intermittent provider errors occurred during testing, including on the public API. Retries improve resilience but cannot guarantee provider availability. Project quotas still apply and no billing settings were changed.

Validation: 24 automated tests, TypeScript checking, and production builds passed. Live requests use the project's real Gemini allowance. Generated JSON and diagnostics are kept in ignored `outputs/e2e/`.

The Google Form has not been submitted.

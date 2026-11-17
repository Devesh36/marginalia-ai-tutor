# Gemini verification — 17 November 2026

Live application: https://marginalia-ai-tutor.vercel.app

The deployment uses `gemini-3.5-flash-lite` through the server-side Gemini API. Local Codex remains available on loopback; the public status endpoint reports Codex unavailable and Gemini available.

## Credential handling

- The local key lives only in ignored `.env.local`, with file permissions `600`.
- The production key was sent to Vercel through standard input and stored as a sensitive production environment variable.
- Neither the key nor an environment file was committed. A scan of staged source and browser assets found no occurrence of the actual key.
- The public HTML, status response, and seven loaded JavaScript assets were also scanned; none contained the key.

## Successful live checks

| Environment    | Topic             | Observed result                                                                                                                                                                                                                                                                               |
| -------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local Gemini   | Fractions         | Valid lesson, 11 steps, approximately 1:41 narration. Generation took 10.5 seconds; two follow-ups took 1.4 and 1.7 seconds. The second reused the first explanation with pizzas.                                                                                                             |
| Local Gemini   | Supply and demand | Valid lesson, 15 steps, approximately 1:49 narration. Generation took 13.5 seconds; both follow-ups completed. A terminology issue in an answer prompted a clarification instruction; its retest correctly distinguished a supply shift from movement along demand.                           |
| Public API     | Fractions         | A valid lesson was generated in 13.3 seconds. An initial follow-up hit an upstream error. After the final resilience update, both follow-ups using that lesson passed (3.4 and 10.9 seconds), including the contextual pizza example.                                                         |
| Public browser | Binary search     | Generated a five-chapter, 15-step lesson. Real speech advanced the board and captions; pause and chapter/step seeking worked. Two follow-ups correctly explained the empty search range and traced the previous answer’s example step by step. The browser console had no errors or warnings. |

These are observed examples, not a guarantee that every generated explanation is correct. Narration duration is an estimate, and provider latency varies.

## Integration fixes and limits

- Gemini 3.8 requests failed or timed out during testing. Gemini 2.5 Flash worked but reached this project's reported 20-request daily free-tier limit. The older 2.5 Flash-Lite endpoint returned a migration response naming 3.5 Flash-Lite, which passed live checks.
- A schema with bounds on every nested array/number exceeded Gemini's serving complexity limit. The compact schema now supplies clear field descriptions and exactly three quiz choices, while Zod retains the full application validation.
- Shorter summary instructions resolved repeated overlong summaries. The older 2.5 Flash family uses a zero thinking budget to reserve output for lesson JSON; other configured models retain their defaults.
- Temporary HTTP 500/502/503/504 failures receive at most two retries, with short backoff and the same overall request deadline. Quota and credential failures are not retried. Model-unavailable, output-limit, and quota failures have explicit user-facing errors.
- Intermittent provider errors occurred during testing, including on the public API. Retries improve resilience but cannot guarantee provider availability. Project quotas still apply and no billing settings were changed.

Validation: 24 automated tests, TypeScript checking, and production builds passed. Live requests use the project's real Gemini allowance. Generated JSON and diagnostics are kept in ignored `outputs/e2e/`.

## Final submission check

On 17 November 2026, the public repository and live deployment were checked again at application commit `c795eac`.

- A fresh binary-search lesson generated successfully with four chapters and 12 steps (estimated narration 1:39). Browser narration advanced the board and captions from step 1 to step 4. Pause/resume, forward/backward seeking, restart, chapter navigation, and quiz feedback worked.
- A follow-up asking about an absent target correctly reused the lesson's array `[3, 7, 12, 19, 25]` and explained why searching for 20 exhausts the range.
- Two earlier photosynthesis attempts did not succeed: one failed narration-length validation after repair, and the other timed out. These are disclosed generation limitations, not successful checks.
- A fresh scan found no occurrence of the actual Gemini key in tracked files, public HTML, or seven public JavaScript assets. The local environment file remained ignored with permissions `600`.

The Braynix Studios Google Form was submitted successfully on 17 November 2026. Its confirmation page stated: “Your assignment has been submitted successfully. Thank you for completing the Braynix Studios assignment!” Both public links, AI-tool usage, and known limitations were included. Local screenshots are saved under ignored `outputs/e2e/final-live-check.jpg` and `outputs/e2e/assignment-submission-confirmation.jpg`.

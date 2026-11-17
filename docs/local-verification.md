# Local verification — 16 November 2026

Provider: signed-in local Codex CLI. Server: Next.js on loopback. Browser: the Codex desktop in-app browser on macOS. No Gemini key was added and no deployment was changed.

## Live lesson and conversation checks

| Topic              | Result                                                                                                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Binary search      | Played all 12 steps across four chapters continuously with real browser speech; reached Replay at the end. Estimated narration 1:53.                                                                            |
| Adding 1/2 and 1/3 | Live API generation and two follow-ups passed; the second question reused the preceding explanation with a pizza analogy. Estimated narration approximately two minutes.                                        |
| Supply and demand  | Initially failed validation; passed after the small-marker fix. 16 steps, estimated narration 2:12. Follow-ups correctly explained higher lemon costs and the distinction between demand and quantity demanded. |
| Photosynthesis     | Generated through the UI, 12 steps, estimated narration 1:53. Follow-ups answered nighttime growth and resolved “Does it release oxygen then?” using the prior nighttime context.                               |

Generation times varied; the successful supply-and-demand run took 63 seconds, with follow-ups around 12–13 seconds. Timing is observed evidence, not a latency guarantee.

## Browser checks

- Real speech completion advanced captions and board scenes through a complete binary-search lesson. Browser speech events were observed; this does not certify audio quality on other devices or speakers.
- Pausing photosynthesis held the displayed time and board steady. Resume continued; forward and backward seeks while speaking rebuilt the matching scene. A paused seek stayed stopped.
- Rapid Home/ArrowRight seeks, final-step seeking, chapter navigation, transcript navigation, restart, replay, and speed changes worked.
- Switching between narration and explicit captions mode preserved the selected step. Captions advanced time and completed the final step.
- Asking a follow-up during playback paused the lesson and retained the board.
- Quiz feedback worked for wrong and correct choices; after completion the quiz could be hidden, and replay returned to the first step.
- Pen/color selection paused playback. Pointer drawing created a stroke; undo and clear removed it.
- Canceling a pending generation restored the input; immediate retry succeeded. The canceled Codex child was no longer running.
- A narrow mobile viewport had no horizontal page overflow, and the drawing toolbar remained outside the diagram. Mobile speech-engine behavior was not tested on physical phones.
- API checks returned expected errors for empty/oversized topics, an unknown provider, malformed JSON, cross-origin requests, and Gemini without a key.

## Fixes from this pass

1. Allowed small unlabeled diagram markers (minimum 4×4) while retaining minimum sizes for text/labeled shapes. The previous 30-pixel minimum incorrectly rejected valid graph intersections and point markers. Added a regression test and element-indexed validation feedback.
2. Made quiz visibility explicit when playback ends, so Hide works; reset answers for restart/replay.
3. Reserved space below the SVG for drawing tools, which previously overlapped a low photosynthesis arrow.

The live API runner is `npm run test:local`; generated JSON and logs stay in ignored `outputs/e2e/`. Unit tests use a fake voice transport for event ordering and stale-callback races. Gemini remains unverified until its server-side key is configured.

import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { lessonSchema, followupSchema, timeline, boardAt } from '../lib/lesson';

const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:3000').origin;
const provider = process.env.TEST_PROVIDER || 'codex';
assert.ok(provider === 'codex' || provider === 'gemini', 'Invalid TEST_PROVIDER');
const outputDir = `outputs/e2e/${provider}-${new URL(base).hostname}`;
const cases = [
  {
    id: 'fractions',
    topic: 'Why does one half plus one third equal five sixths? Show fractions visually.',
    questions: ['Why can’t I just add the denominators?', 'Show that using pizzas instead.'],
  },
  {
    id: 'supply-demand',
    topic: 'Explain supply and demand using a lemonade stand.',
    questions: [
      'What happens if lemons become more expensive?',
      'Does that change demand too, or only supply?',
    ],
  },
].filter((entry) => !process.argv[2] || entry.id === process.argv[2]);
assert.ok(cases.length, 'Unknown topic case');
await mkdir(outputDir, { recursive: true });
const results: unknown[] = [];
async function post(path: string, body: unknown) {
  const start = Date.now();
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(195_000),
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return { data, seconds: Math.round((Date.now() - start) / 100) / 10 };
}
await Promise.all(
  cases.map(async (c) => {
    try {
      const { data, seconds } = await post('/api/lesson', { topic: c.topic, provider });
      assert.equal(data.provider, provider);
      const lesson = lessonSchema.parse(data.lesson);
      const steps = timeline(lesson);
      for (let i = steps.length - 1; i >= 0; i--) {
        const board = boardAt(lesson, i);
        assert.ok(board.elements.length);
        assert.ok(board.focus.every((id) => board.elements.some((e) => e.id === id)));
      }
      await writeFile(`${outputDir}/${c.id}-lesson.json`, JSON.stringify(data, null, 2));
      console.log(JSON.stringify({ topic: c.id, phase: 'lesson', seconds, steps: steps.length }));
      const history: { role: 'user' | 'assistant'; content: string }[] = [];
      const answers = [];
      for (const question of c.questions) {
        const response = await post('/api/followup', {
          provider,
          lesson,
          history,
          question,
        });
        const answer = followupSchema.parse(response.data);
        assert.equal(response.data.provider, provider);
        history.push(
          { role: 'user', content: question },
          { role: 'assistant', content: answer.answer },
        );
        answers.push({ question, ...answer, seconds: response.seconds });
        console.log(JSON.stringify({ topic: c.id, phase: 'followup', seconds: response.seconds }));
      }
      const result = {
        id: c.id,
        provider,
        base,
        topic: c.topic,
        passed: true,
        lessonSeconds: seconds,
        estimatedNarrationSeconds: Math.round(steps.at(-1)!.start + steps.at(-1)!.duration),
        steps: steps.length,
        answers,
      };
      results.push(result);
      await writeFile(`${outputDir}/${c.id}-result.json`, JSON.stringify(result, null, 2));
    } catch (error) {
      results.push({ id: c.id, passed: false, error: String(error) });
      console.log(c.id, String(error));
      process.exitCode = 1;
    }
  }),
);
await writeFile(`${outputDir}/api-results.json`, JSON.stringify(results, null, 2));

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseProvider, isLocalRequest, AppError } from '../lib/server/ai';
import { readJson, acquire } from '../lib/server/http';
const request = (body: string, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/lesson', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
test('remote requests cannot run local Codex', () => {
  assert.equal(isLocalRequest(new Request('https://tutor.example/api/lesson')), false);
  assert.throws(
    () => chooseProvider(new Request('https://tutor.example/api/lesson'), 'codex'),
    AppError,
  );
});
test('cross-origin calls are rejected before reaching a provider', async () => {
  await assert.rejects(
    readJson(request('{}', { origin: 'https://untrusted.example' }), 2000),
    /must come from/,
  );
});
test('invalid JSON and oversized bodies are rejected', async () => {
  await assert.rejects(readJson(request('{broken'), 2000), /Invalid JSON/);
  await assert.rejects(
    readJson(request(JSON.stringify({ topic: 'x'.repeat(200) })), 100),
    /too large/,
  );
});
test('valid same-origin JSON is accepted', async () => {
  assert.deepEqual(
    await readJson(request('{"topic":"gravity"}', { origin: 'http://localhost:3000' }), 2000),
    { topic: 'gravity' },
  );
});
test('concurrent generation is bounded and released once', () => {
  const r = request('{}', { 'x-vercel-forwarded-for': 'test-concurrency' });
  const release = [acquire(r), acquire(r), acquire(r)];
  assert.throws(() => acquire(r), /helping a few/);
  release[0]();
  release[0]();
  const extra = acquire(r);
  release[1]();
  release[2]();
  extra();
});

test('invalid model output gets one repair attempt with useful validation feedback', async () => {
  const { generateLesson } = await import('../lib/server/generate-lesson');
  const { sample } = await import('../lib/sample');
  let calls = 0;
  let repair = '';
  const lesson = await generateLesson(
    'codex',
    'neural networks',
    new AbortController().signal,
    async (_provider, prompt) => {
      calls++;
      if (calls === 1) return { bad: 'draft' };
      repair = prompt;
      return sample.lesson;
    },
  );
  assert.equal(calls, 2);
  assert.match(repair, /VALIDATION ISSUES/);
  assert.equal(lesson.title, sample.lesson.title);
});
test('invalid model output never escapes after both attempts fail', async () => {
  const { generateLesson } = await import('../lib/server/generate-lesson');
  let calls = 0;
  await assert.rejects(
    generateLesson('codex', 'topic', new AbortController().signal, async () => {
      calls++;
      return {};
    }),
    /still did not pass/,
  );
  assert.equal(calls, 2);
});

test('loopback browser origin works when Next normalizes the request URL', async () => {
  assert.deepEqual(
    await readJson(
      request('{"topic":"gravity"}', { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' }),
      2000,
    ),
    { topic: 'gravity' },
  );
});

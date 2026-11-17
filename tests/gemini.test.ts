import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateJson, AppError } from '../lib/server/ai';

test('Gemini response parsing skips thought parts and keeps the key out of the URL', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = 'test-key-not-a-real-secret';
  process.env.GEMINI_MODEL = 'gemini-2.5-flash';
  try {
    globalThis.fetch = async (input, init) => {
      assert.ok(!String(input).includes('test-key'));
      const body = JSON.parse(String(init?.body));
      assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
      assert.equal(
        (init?.headers as Record<string, string>)['x-goog-api-key'],
        'test-key-not-a-real-secret',
      );
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                { thought: true, text: 'private reasoning' },
                { text: '{"answer":"Useful explanation"}' },
              ],
            },
          },
        ],
      });
    };
    assert.deepEqual(
      await generateJson('gemini', 'test prompt', { type: 'object' }, new AbortController().signal),
      { answer: 'Useful explanation' },
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = previousModel;
  }
});
test('Gemini quota, blocked output, and malformed JSON produce useful errors without provider diagnostics', async () => {
  const previousFetch = globalThis.fetch;
  try {
    for (const [response, status] of [
      [new Response('upstream details with secrets', { status: 429 }), 429],
      [new Response('unavailable model', { status: 404 }), 503],
      [Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 422],
      [Response.json({ candidates: [{ content: { parts: [{ text: '{truncated' }] } }] }), 502],
      [
        Response.json({
          candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }],
        }),
        502,
      ],
    ] as const) {
      globalThis.fetch = async () => response;
      await assert.rejects(
        generateJson('gemini', 'test', { type: 'object' }, new AbortController().signal),
        (e: unknown) =>
          e instanceof AppError && e.status === status && !e.message.includes('upstream details'),
      );
    }
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Gemini bounds transient retries and never retries quota failures', async () => {
  const previousFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) return new Response('temporary failure', { status: 503 });
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] });
    };
    assert.deepEqual(
      await generateJson('gemini', 'test', { type: 'object' }, new AbortController().signal),
      { ok: true },
    );
    assert.equal(calls, 2);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response('temporary failure', { status: 503 });
    };
    await assert.rejects(
      generateJson('gemini', 'test', { type: 'object' }, new AbortController().signal),
      (e: unknown) => e instanceof AppError && e.status === 502,
    );
    assert.equal(calls, 3);
    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response('quota', { status: 429 });
    };
    await assert.rejects(
      generateJson('gemini', 'test', { type: 'object' }, new AbortController().signal),
      (e: unknown) => e instanceof AppError && e.status === 429,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

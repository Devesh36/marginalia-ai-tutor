import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateJson, AppError } from '../lib/server/ai';

test('Gemini response parsing skips thought parts and keeps the key out of the URL', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key-not-a-real-secret';
  try {
    globalThis.fetch = async (input, init) => {
      assert.ok(!String(input).includes('test-key'));
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
  }
});
test('Gemini quota, blocked output, and malformed JSON produce useful errors without provider diagnostics', async () => {
  const previousFetch = globalThis.fetch;
  try {
    for (const [response, status] of [
      [new Response('upstream details with secrets', { status: 429 }), 429],
      [Response.json({ promptFeedback: { blockReason: 'SAFETY' } }), 422],
      [Response.json({ candidates: [{ content: { parts: [{ text: '{truncated' }] } }] }), 502],
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

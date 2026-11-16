import { z } from 'zod';
import { AppError } from './ai';

const buckets = new Map<string, { count: number; until: number }>();
let active = 0;
export async function readJson(request: Request, maxBytes: number) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new AppError('Expected a JSON request.', 415);
  const origin = request.headers.get('origin');
  // Next dev normalizes request.url to localhost even when the browser uses
  // 127.0.0.1. Host is the browser's actual destination (not a forwarded host).
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  const expectedOrigin = `${process.env.VERCEL ? 'https:' : url.protocol}//${host}`;
  if (origin && origin !== expectedOrigin)
    throw new AppError('This request must come from the tutor application.', 403);
  if (Number(request.headers.get('content-length') || 0) > maxBytes)
    throw new AppError('Request is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('Request body is missing.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError('Request is too large.', 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError('Invalid JSON request.', 400);
  }
}
export function acquire(request: Request) {
  const now = Date.now();
  for (const [key, value] of buckets) if (value.until < now) buckets.delete(key);
  const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const bucket = buckets.get(ip) ?? { count: 0, until: now + 60_000 };
  if (bucket.count >= 8)
    throw new AppError('Please wait a minute before asking for more lessons or answers.', 429);
  if (active >= 3)
    throw new AppError(
      'The tutor is helping a few learners right now. Please try again shortly.',
      429,
    );
  bucket.count++;
  buckets.set(ip, bucket);
  active++;
  let released = false;
  return () => {
    if (!released) {
      active--;
      released = true;
    }
  };
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError)
    return Response.json(
      { error: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: 'Please provide a valid topic or question within the displayed length limit.',
      },
      { status: 400 },
    );
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
export const providerInput = z.enum(['codex', 'gemini']).optional();
export const topicInput = z.string().trim().min(3).max(300);

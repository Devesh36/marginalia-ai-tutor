import { z } from 'zod';
import { chooseProvider } from '@/lib/server/ai';
import { generateLesson } from '@/lib/server/generate-lesson';
import { acquire, errorResponse, providerInput, readJson, topicInput } from '@/lib/server/http';

export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const { topic, provider: requested } = z
      .object({ topic: topicInput, provider: providerInput })
      .parse(await readJson(request, 2500));
    const provider = chooseProvider(request, requested);
    release = acquire(request);
    const lesson = await generateLesson(provider, topic, request.signal);
    return Response.json(
      { lesson, provider, createdAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  } finally {
    release?.();
  }
}

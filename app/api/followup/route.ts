import { z } from 'zod';
import { lessonSchema, followupSchema, followupJsonSchema } from '@/lib/lesson';
import { AppError, chooseProvider, generateJson } from '@/lib/server/ai';
import { FOLLOWUP_INSTRUCTIONS } from '@/lib/server/prompts';
import { acquire, errorResponse, providerInput, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const input = z
      .object({
        question: z.string().trim().min(2).max(600),
        provider: providerInput,
        lesson: lessonSchema,
        history: z
          .array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string().max(2400),
            }),
          )
          .max(10),
      })
      .parse(await readJson(request, 100_000));
    const provider = chooseProvider(request, input.provider);
    release = acquire(request);
    const context = {
      lesson: {
        title: input.lesson.title,
        scenes: input.lesson.scenes.map((s) => ({
          title: s.title,
          narration: s.beats.map((b) => b.narration),
        })),
      },
      history: input.history,
      question: input.question,
    };
    const raw = await generateJson(
      provider,
      `${FOLLOWUP_INSTRUCTIONS}\nCONTEXT (JSON): ${JSON.stringify(context)}`,
      followupJsonSchema,
      request.signal,
    );
    const result = followupSchema.safeParse(raw);
    if (!result.success)
      throw new AppError('The tutor returned an incomplete answer. Please try again.', 502);
    return Response.json(
      { ...result.data, provider },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  } finally {
    release?.();
  }
}

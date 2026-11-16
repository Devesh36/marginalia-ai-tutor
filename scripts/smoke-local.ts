import { writeFile, mkdir } from 'node:fs/promises';
import { generateJson } from '../lib/server/ai';
import { LESSON_INSTRUCTIONS } from '../lib/server/prompts';
import { lessonJsonSchema, lessonSchema, timeline } from '../lib/lesson';
await mkdir('outputs', { recursive: true });
const raw = await generateJson(
  'codex',
  `${LESSON_INSTRUCTIONS}\nLEARNER SUBJECT (JSON): "Why does the sky look blue?"`,
  lessonJsonSchema,
  AbortSignal.timeout(190_000),
);
await writeFile('outputs/codex-raw.json', JSON.stringify(raw, null, 2));
const parsed = lessonSchema.safeParse(raw);
if (!parsed.success) {
  console.log(JSON.stringify(parsed.error.issues));
  process.exitCode = 1;
} else {
  await writeFile(
    'outputs/live-lesson.json',
    JSON.stringify({
      lesson: parsed.data,
      provider: 'codex',
      createdAt: new Date().toISOString(),
    }),
  );
  console.log({
    title: parsed.data.title,
    scenes: parsed.data.scenes.length,
    steps: timeline(parsed.data).length,
  });
}

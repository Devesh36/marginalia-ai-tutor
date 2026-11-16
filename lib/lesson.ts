import { z } from 'zod';

export const elementSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(['box', 'ellipse', 'text', 'arrow', 'line']),
  x: z.number().min(20).max(880),
  y: z.number().min(20).max(470),
  w: z.number().min(-840).max(840),
  h: z.number().min(-450).max(450),
  label: z.string().max(90),
  color: z.enum(['ink', 'green', 'orange', 'blue', 'purple']),
});
export const beatSchema = z.object({
  narration: z.string().min(12).max(650),
  reveal: z.array(z.string().max(40)).max(20),
  focus: z.array(z.string().max(40)).max(20),
});
const sceneSchema = z.object({
  title: z.string().min(1).max(70),
  elements: z.array(elementSchema).min(1).max(20),
  beats: z.array(beatSchema).min(1).max(6),
});
export const lessonSchema = z
  .object({
    title: z.string().min(1).max(90),
    summary: z.string().min(1).max(240),
    scenes: z.array(sceneSchema).min(3).max(6),
    quiz: z.object({
      question: z.string().min(1).max(240),
      choices: z.array(z.string().min(1).max(160)).length(3),
      answer: z.number().int().min(0).max(2),
      explanation: z.string().min(1).max(400),
    }),
  })
  .superRefine((lesson, ctx) => {
    for (const [si, scene] of lesson.scenes.entries()) {
      const ids = new Set(scene.elements.map((e) => e.id));
      if (ids.size !== scene.elements.length)
        ctx.addIssue({
          code: 'custom',
          message: 'Duplicate element IDs',
          path: ['scenes', si],
        });
      const visible = new Set<string>();
      for (const [bi, beat] of scene.beats.entries()) {
        beat.reveal.forEach((id) => visible.add(id));
        if ([...beat.reveal, ...beat.focus].some((id) => !ids.has(id)))
          ctx.addIssue({
            code: 'custom',
            message: 'Unknown board element',
            path: ['scenes', si, 'beats', bi],
          });
        if (beat.focus.some((id) => !visible.has(id)) || !visible.size)
          ctx.addIssue({
            code: 'custom',
            message: 'Each beat needs visible teaching elements',
            path: ['scenes', si, 'beats', bi],
          });
      }
      for (const e of scene.elements) {
        if (
          e.x + e.w < 10 ||
          e.x + e.w > 900 ||
          e.y + e.h < 10 ||
          e.y + e.h > 500 ||
          (['box', 'ellipse', 'text'].includes(e.type) && (e.w < 30 || e.h < 20))
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Element outside board or invalid size',
            path: ['scenes', si, 'elements'],
          });
        }
      }
    }
    const words = lesson.scenes
      .flatMap((s) => s.beats)
      .reduce((n, b) => n + wordCount(b.narration), 0);
    if (words < 200 || words > 380)
      ctx.addIssue({
        code: 'custom',
        message: 'Lesson narration must be 200–380 words',
      });
  });
export type Lesson = z.infer<typeof lessonSchema>;
export type BoardElement = z.infer<typeof elementSchema>;
export type Beat = z.infer<typeof beatSchema>;
export type Provider = 'codex' | 'gemini';
export type LessonEnvelope = {
  lesson: Lesson;
  provider: Provider | 'sample';
  createdAt: string;
};
export type TimelineStep = Beat & {
  sceneIndex: number;
  beatIndex: number;
  start: number;
  duration: number;
};
export const wordCount = (text: string) => text.trim().split(/\s+/).length;

export function timeline(lesson: Lesson): TimelineStep[] {
  let start = 0;
  return lesson.scenes.flatMap((scene, sceneIndex) =>
    scene.beats.map((beat, beatIndex) => {
      const duration = Math.max(2, wordCount(beat.narration) / 2.3);
      const step = { ...beat, sceneIndex, beatIndex, start, duration };
      start += duration;
      return step;
    }),
  );
}

/** Pure reconstruction: a seek never depends on previously played steps. */
export function boardAt(lesson: Lesson, stepIndex: number) {
  const steps = timeline(lesson);
  const step = steps[Math.max(0, Math.min(steps.length - 1, stepIndex))];
  const scene = lesson.scenes[step.sceneIndex];
  const visible = new Set(scene.beats.slice(0, step.beatIndex + 1).flatMap((b) => b.reveal));
  return {
    scene,
    sceneIndex: step.sceneIndex,
    elements: scene.elements.filter((e) => visible.has(e.id)),
    focus: step.focus,
  };
}

const string = { type: 'string' };
const strings = { type: 'array', items: string };
const object = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

// Shared by Gemini structured output and Codex --output-schema.
export const lessonJsonSchema = object({
  title: string,
  summary: string,
  scenes: {
    type: 'array',
    items: object({
      title: string,
      elements: {
        type: 'array',
        items: object({
          id: string,
          type: {
            type: 'string',
            enum: ['box', 'ellipse', 'text', 'arrow', 'line'],
          },
          x: { type: 'number' },
          y: { type: 'number' },
          w: { type: 'number' },
          h: { type: 'number' },
          label: string,
          color: {
            type: 'string',
            enum: ['ink', 'green', 'orange', 'blue', 'purple'],
          },
        }),
      },
      beats: {
        type: 'array',
        items: object({ narration: string, reveal: strings, focus: strings }),
      },
    }),
  },
  quiz: object({
    question: string,
    choices: strings,
    answer: { type: 'integer' },
    explanation: string,
  }),
});
export const followupSchema = z.object({
  answer: z.string().min(1).max(2400),
  suggestions: z.array(z.string().min(1).max(160)).max(3),
});
export const followupJsonSchema = object({
  answer: string,
  suggestions: strings,
});

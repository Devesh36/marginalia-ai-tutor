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
      for (const [ei, e] of scene.elements.entries()) {
        // Small unlabeled markers are useful for graph intersections and geometry.
        const minWidth = e.type === 'text' || e.label.trim() ? 30 : 4;
        const minHeight = e.type === 'text' || e.label.trim() ? 20 : 4;
        if (
          e.x + e.w < 10 ||
          e.x + e.w > 900 ||
          e.y + e.h < 10 ||
          e.y + e.h > 500 ||
          (['box', 'ellipse', 'text'].includes(e.type) && (e.w < minWidth || e.h < minHeight))
        ) {
          ctx.addIssue({
            code: 'custom',
            message: `Element ${e.id}: endpoints must be within x=10..900, y=10..500; shapes need width >= ${minWidth}, height >= ${minHeight}`,
            path: ['scenes', si, 'elements', ei],
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
// Keep nested constraints compact: Gemini can reject bounds on every nested
// array/number as too complex. Descriptions guide lengths; Zod enforces them.
export const lessonJsonSchema = object({
  title: { ...string, description: 'A short lesson title, at most 90 characters.' },
  summary: {
    ...string,
    description: 'ONE short sentence of 12–20 words. Maximum 240 characters, including spaces.',
  },
  scenes: {
    type: 'array',
    items: object({
      title: { ...string, description: 'Chapter title, at most 70 characters.' },
      elements: {
        type: 'array',
        items: object({
          id: {
            ...string,
            description: 'Unique short ID within this scene, at most 40 characters.',
          },
          type: {
            type: 'string',
            enum: ['box', 'ellipse', 'text', 'arrow', 'line'],
          },
          x: { type: 'number', description: 'Start x: 20 to 880.' },
          y: { type: 'number', description: 'Start y: 20 to 470.' },
          w: {
            type: 'number',
            description: 'Width or line delta; endpoint x+w must be within 20 to 900.',
          },
          h: {
            type: 'number',
            description: 'Height or line delta; endpoint y+h must be within 20 to 500.',
          },
          label: {
            ...string,
            description:
              'Short diagram label, ideally 1–5 words, maximum 90 characters. Empty for unlabeled shapes.',
          },
          color: {
            type: 'string',
            enum: ['ink', 'green', 'orange', 'blue', 'purple'],
          },
        }),
      },
      beats: {
        type: 'array',
        items: object({
          narration: {
            ...string,
            description: 'One or two spoken sentences, 12–30 words, maximum 650 characters.',
          },
          reveal: strings,
          focus: strings,
        }),
      },
    }),
  },
  quiz: object({
    question: { ...string, description: 'One concise quiz question, at most 240 characters.' },
    choices: {
      ...strings,
      minItems: 3,
      maxItems: 3,
      items: { ...string, description: 'A short answer choice, at most 160 characters.' },
    },
    answer: { type: 'integer', enum: [0, 1, 2] },
    explanation: { ...string, description: 'Brief explanation, at most 400 characters.' },
  }),
});
export const followupSchema = z.object({
  answer: z.string().min(1).max(2400),
  suggestions: z.array(z.string().min(1).max(160)).max(3),
});
export const followupJsonSchema = object({
  answer: { ...string, description: 'Direct answer, at most 180 words and 2400 characters.' },
  suggestions: {
    ...strings,
    maxItems: 3,
    items: { ...string, description: 'Short follow-up suggestion, at most 160 characters.' },
  },
});

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Provider } from '../lesson';

export class AppError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}
export const isLocalRequest = (request: Request) => {
  const host = new URL(request.url).hostname;
  return !process.env.VERCEL && ['localhost', '127.0.0.1', '[::1]'].includes(host);
};
export function providers(request: Request) {
  return {
    codex: isLocalRequest(request),
    gemini: !!process.env.GEMINI_API_KEY,
  };
}
export function chooseProvider(request: Request, requested?: Provider): Provider {
  const available = providers(request);
  const selected =
    requested ?? (process.env.AI_PROVIDER === 'codex' && available.codex ? 'codex' : 'gemini');
  if (!available[selected])
    throw new AppError(
      selected === 'codex'
        ? 'Local Codex is only available on the local development server.'
        : 'Gemini is not configured yet. Set GEMINI_API_KEY on the server. You can explore the labeled sample lesson meanwhile.',
      503,
    );
  return selected;
}

export async function generateJson(
  provider: Provider,
  prompt: string,
  schema: Record<string, unknown>,
  signal: AbortSignal,
): Promise<unknown> {
  return provider === 'codex' ? codex(prompt, schema, signal) : gemini(prompt, schema, signal);
}

async function gemini(prompt: string, schema: Record<string, unknown>, signal: AbortSignal) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  if (!/^[a-z0-9.-]+$/.test(model)) throw new AppError('Invalid server model configuration.', 503);
  const timeout = AbortSignal.timeout(85_000);
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 14000,
            responseMimeType: 'application/json',
            responseJsonSchema: schema,
          },
        }),
        signal: AbortSignal.any([signal, timeout]),
      },
    );
  } catch {
    throw new AppError(
      signal.aborted ? 'Request cancelled.' : 'Gemini took too long to respond. Please try again.',
      504,
    );
  }
  if (!response.ok) {
    if (response.status === 429)
      throw new AppError('Gemini is at its usage limit. Please wait a moment and try again.', 429);
    if (response.status === 400 || response.status === 401 || response.status === 403)
      throw new AppError(
        'Gemini could not accept the request. Check the server API key, model, and project access.',
        502,
      );
    throw new AppError('Gemini is temporarily unavailable. Please try again.', 502);
  }
  const result = await response.json();
  const text = (result.candidates?.[0]?.content?.parts ?? [])
    .filter((p: { thought?: boolean }) => !p.thought)
    .map((p: { text?: string }) => p.text ?? '')
    .join('');
  if (!text)
    throw new AppError(
      'The model could not produce a lesson for this topic. Try a more specific educational topic.',
      422,
    );
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('The model returned an incomplete response. Please try again.', 502);
  }
}

async function codex(prompt: string, schema: Record<string, unknown>, signal: AbortSignal) {
  const dir = await mkdtemp(join(tmpdir(), 'marginalia-'));
  const output = join(dir, 'response.json');
  await writeFile(join(dir, 'schema.json'), JSON.stringify(schema));
  // Never interpolate a learner's topic into a shell command. No shell is used.
  // Ignore personal config/instructions and remove tools from this generation-only run.
  const disabled = [
    'shell_tool',
    'unified_exec',
    'apps',
    'plugins',
    'hooks',
    'memories',
    'multi_agent',
    'browser_use',
    'browser_use_external',
    'computer_use',
    'in_app_browser',
    'image_generation',
    'view_image',
    'skill_search',
    'chronicle',
  ];
  const args = [
    'exec',
    '--ignore-user-config',
    '--ignore-rules',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--color',
    'never',
    '-c',
    'web_search="disabled"',
    '-c',
    'project_doc_max_bytes=0',
    '-c',
    'features.skip_host_skill_discovery=true',
    ...disabled.flatMap((feature) => ['--disable', feature]),
    '--output-schema',
    join(dir, 'schema.json'),
    '--output-last-message',
    output,
    '-',
  ];
  try {
    await new Promise<void>((resolve, reject) => {
      const env: NodeJS.ProcessEnv = {
        NODE_ENV: process.env.NODE_ENV,
        ...Object.fromEntries(
          [
            'PATH',
            'HOME',
            'CODEX_HOME',
            'USER',
            'TMPDIR',
            'LANG',
            'SSL_CERT_FILE',
            'NODE_EXTRA_CA_CERTS',
          ].flatMap((k) => (process.env[k] ? [[k, process.env[k]!]] : [])),
        ),
      };
      const child = spawn(/* turbopackIgnore: true */ process.env.CODEX_BIN || 'codex', args, {
        cwd: dir,
        env,
        stdio: ['pipe', 'ignore', 'pipe'],
      });
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        if (error) {
          child.kill('SIGTERM');
          reject(error);
        } else resolve();
      };
      const cancel = () => finish(new AppError('Request cancelled.', 499));
      const timer = setTimeout(
        () =>
          finish(
            new AppError(
              'Local Codex took longer than three minutes. Try again with a more specific topic.',
              504,
            ),
          ),
        180_000,
      );
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      child.stderr.on('data', () => {}); // Drain diagnostics without exposing account details.
      child.on('error', () =>
        finish(
          new AppError(
            'Could not start Codex. Install the Codex CLI and run codex login, then retry.',
            503,
          ),
        ),
      );
      child.on('close', (code) =>
        finish(
          code === 0
            ? undefined
            : new AppError(
                'Local Codex could not finish. Check codex login status in your terminal and retry.',
                502,
              ),
        ),
      );
      child.stdin.on('error', () => {});
      child.stdin.end(prompt);
    });
    const raw = await readFile(output, 'utf8');
    if (raw.length > 150_000)
      throw new AppError('The generated lesson was too large. Try again.', 502);
    try {
      return JSON.parse(raw);
    } catch {
      throw new AppError('Codex returned an incomplete response. Please retry.', 502);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

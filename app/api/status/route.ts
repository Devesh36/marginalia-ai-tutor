import { providers } from '@/lib/server/ai';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  const available = providers(request);
  return Response.json(
    {
      available,
      defaultProvider: process.env.AI_PROVIDER === 'codex' && available.codex ? 'codex' : 'gemini',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

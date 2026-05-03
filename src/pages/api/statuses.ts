import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const HEADERS = { 'Content-Type': 'application/json' };

// GET /api/statuses?ids=id1,id2,...
// Returns { id1: 'pendiente', id2: 'en_pobox', ... }
export const GET: APIRoute = async ({ url }) => {
  try {
    const idsParam = url.searchParams.get('ids')?.trim();
    if (!idsParam) return new Response('{}', { status: 200, headers: HEADERS });

    const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50);
    if (ids.length === 0) return new Response('{}', { status: 200, headers: HEADERS });

    const db = (env as any).DB;
    if (!db) return new Response('{}', { status: 200, headers: HEADERS });

    const placeholders = ids.map(() => '?').join(',');
    const result = await db
      .prepare(`SELECT id, status FROM analyses WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all();

    const map: Record<string, string> = {};
    for (const row of (result.results as any[])) {
      map[row.id as string] = (row.status as string) ?? 'pendiente';
    }

    return new Response(JSON.stringify(map), { status: 200, headers: HEADERS });
  } catch {
    return new Response('{}', { status: 200, headers: HEADERS });
  }
};

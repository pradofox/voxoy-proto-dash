import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const HEADERS = { 'Content-Type': 'application/json' };

export const GET: APIRoute = async () => {
  try {
    const db = (env as any).DB;
    if (!db) return new Response(JSON.stringify([]), { status: 200, headers: HEADERS });

    const result = await db
      .prepare('SELECT data, status FROM analyses ORDER BY timestamp DESC LIMIT 200')
      .all();

    const items = (result.results as any[]).map((row) => ({
      ...JSON.parse(row.data),
      _status: row.status ?? 'pendiente',
    }));

    return new Response(JSON.stringify(items), { status: 200, headers: HEADERS });
  } catch (err: any) {
    console.error('history GET error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
};

// Update status of a single analysis
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const { id, status } = await request.json();
    if (!id || !status) {
      return new Response(JSON.stringify({ error: 'id y status requeridos' }), {
        status: 400,
        headers: HEADERS,
      });
    }

    const db = (env as any).DB;
    if (!db) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });

    await db
      .prepare('UPDATE analyses SET status = ? WHERE id = ?')
      .bind(status, id)
      .run();

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
  } catch (err: any) {
    console.error('history PATCH error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
};

export const DELETE: APIRoute = async () => {
  try {
    const db = (env as any).DB;
    if (!db) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });

    await db.prepare('DELETE FROM analyses').run();
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
  } catch (err: any) {
    console.error('history DELETE error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
};

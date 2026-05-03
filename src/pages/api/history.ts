import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const HEADERS = { 'Content-Type': 'application/json' };

export const GET: APIRoute = async ({ url }) => {
  try {
    const db = (env as any).DB;
    if (!db) return new Response(JSON.stringify([]), { status: 200, headers: HEADERS });

    const trash = url.searchParams.get('trash') === '1';

    const result = await db
      .prepare(
        trash
          ? 'SELECT data, status FROM analyses WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 200'
          : 'SELECT data, status FROM analyses WHERE deleted_at IS NULL ORDER BY timestamp DESC LIMIT 200',
      )
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

// Update status, notes, contact, or trash state for a single analysis
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      id?: string;
      status?: string;
      notes?: string;
      contact?: { nombre: string; whatsapp: string } | null;
      trash?: boolean;
      restore?: boolean;
      purge?: boolean; // permanent delete of this one item
    };

    const { id } = body;
    if (!id) {
      return new Response(JSON.stringify({ error: 'id requerido' }), { status: 400, headers: HEADERS });
    }

    const db = (env as any).DB;
    if (!db) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });

    if (body.purge) {
      await db.prepare('DELETE FROM analyses WHERE id = ?').bind(id).run();
    } else {
      if (body.status !== undefined) {
        await db.prepare('UPDATE analyses SET status = ? WHERE id = ?').bind(body.status, id).run();
      }
      if (body.notes !== undefined) {
        await db.prepare("UPDATE analyses SET data = json_set(data, '$._notes', ?) WHERE id = ?").bind(body.notes, id).run();
      }
      if (body.contact !== undefined) {
        const contactJson = body.contact ? JSON.stringify(body.contact) : null;
        if (contactJson) {
          await db.prepare("UPDATE analyses SET data = json_set(data, '$._contact', json(?)) WHERE id = ?").bind(contactJson, id).run();
        }
      }
      if (body.trash) {
        await db.prepare("UPDATE analyses SET deleted_at = datetime('now') WHERE id = ?").bind(id).run();
      }
      if (body.restore) {
        await db.prepare('UPDATE analyses SET deleted_at = NULL WHERE id = ?').bind(id).run();
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
  } catch (err: any) {
    console.error('history PATCH error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
};

// DELETE without body → soft-delete all active analyses
// DELETE with { purge: true } → permanently delete all trashed analyses
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const db = (env as any).DB;
    if (!db) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });

    let purge = false;
    try {
      const body = await request.json() as { purge?: boolean };
      purge = !!body.purge;
    } catch {}

    if (purge) {
      await db.prepare('DELETE FROM analyses WHERE deleted_at IS NOT NULL').run();
    } else {
      await db.prepare("UPDATE analyses SET deleted_at = datetime('now') WHERE deleted_at IS NULL").run();
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
  } catch (err: any) {
    console.error('history DELETE error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
};

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const HEADERS = { 'Content-Type': 'application/json' };

export const GET: APIRoute = async ({ url }) => {
  const orden = url.searchParams.get('orden')?.trim();
  if (!orden) {
    return new Response(JSON.stringify({ error: 'Número de orden requerido' }), {
      status: 400,
      headers: HEADERS,
    });
  }

  try {
    const db = (env as any).DB;
    if (!db) {
      return new Response(JSON.stringify({ found: false }), { status: 200, headers: HEADERS });
    }

    const row = (await db
      .prepare(
        `SELECT
          JSON_EXTRACT(data, '$.extraido.tienda')   AS tienda,
          JSON_EXTRACT(data, '$.extraido.producto') AS producto,
          JSON_EXTRACT(data, '$.extraido.precio_reportado_usd') AS precio_usd,
          JSON_EXTRACT(data, '$.calculo.fee_mxn')  AS fee_mxn,
          status,
          timestamp
        FROM analyses
        WHERE JSON_EXTRACT(data, '$.extraido.numero_orden') = ?
        ORDER BY timestamp DESC LIMIT 1`,
      )
      .bind(orden)
      .first()) as any;

    if (!row) {
      return new Response(JSON.stringify({ found: false }), { status: 200, headers: HEADERS });
    }

    return new Response(
      JSON.stringify({
        found: true,
        tienda: row.tienda,
        producto: row.producto,
        precio_usd: row.precio_usd,
        fee_mxn: row.fee_mxn,
        status: row.status ?? 'pendiente',
        timestamp: row.timestamp,
      }),
      { status: 200, headers: HEADERS },
    );
  } catch (err: any) {
    console.error('pedido GET error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
};

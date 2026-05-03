import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { analizarRecibo, analisisMock } from '../../lib/claude';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const apiKey = (env as any).ANTHROPIC_API_KEY;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No se subió ningún archivo.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (file.type !== 'application/pdf') {
      return new Response(
        JSON.stringify({ error: 'El archivo debe ser un PDF.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'El archivo es demasiado grande (max 10MB).' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!apiKey) {
      const result = analisisMock(file.name);
      result.error = 'MOCK_MODE: ANTHROPIC_API_KEY no configurada. Mostrando datos de ejemplo.';
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    const result = await analizarRecibo(base64, file.name, apiKey);

    // Check for duplicate order number
    try {
      const db = (env as any).DB;
      const ordenId = result.extraido?.numero_orden;
      if (db && ordenId) {
        const dup = await db
          .prepare(
            "SELECT id FROM analyses WHERE JSON_EXTRACT(data, '$.extraido.numero_orden') = ? AND id != ?",
          )
          .bind(ordenId, result.id)
          .first();
        if (dup) {
          (result as any)._duplicado = true;
          result.score_confianza = Math.min(result.score_confianza, 15);
          result.nivel = 'sospechoso';
          result.razon_corta = `Orden duplicada · ${result.razon_corta}`;
          result.razon_larga =
            `⚠️ ALERTA: El número de orden ${ordenId} ya fue registrado previamente en el sistema. ` +
            `Posible intento de reutilizar el mismo recibo. ` +
            result.razon_larga;
        }
      }
    } catch (dupErr) {
      console.warn('Duplicate check failed (non-fatal)', dupErr);
    }

    // Persist to D1 for cross-browser admin visibility
    try {
      const db = (env as any).DB;
      if (db) {
        await db
          .prepare(
            'INSERT OR REPLACE INTO analyses (id, timestamp, filename, nivel, score, tienda, producto, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            result.id,
            result.timestamp,
            file.name,
            result.nivel,
            result.score_confianza,
            result.extraido?.tienda ?? '',
            result.extraido?.producto ?? '',
            JSON.stringify(result),
          )
          .run();
      }
    } catch (dbErr) {
      console.warn('D1 save failed (non-fatal)', dbErr);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('analyze error', err);
    return new Response(
      JSON.stringify({
        error: err?.message || 'Error desconocido procesando el recibo.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

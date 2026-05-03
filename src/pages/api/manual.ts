import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { calcularFee, TIPO_CAMBIO_USD_MXN } from '../../lib/tabulador';
import type { Categoria } from '../../lib/tabulador';
import type { AnalisisCompleto } from '../../lib/types';

export const prerender = false;

const HEADERS = { 'Content-Type': 'application/json' };

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json() as {
      tienda: string;
      producto: string;
      precio_usd: number;
      categoria: Categoria;
      numero_orden?: string;
      tipoCambio?: number;
    };

    const { tienda, producto, precio_usd, categoria, numero_orden } = body;

    if (!tienda || !producto || !precio_usd || !categoria) {
      return new Response(
        JSON.stringify({ error: 'tienda, producto, precio_usd y categoria son requeridos' }),
        { status: 400, headers: HEADERS },
      );
    }

    const tipoCambio = body.tipoCambio ?? TIPO_CAMBIO_USD_MXN;
    const calculo = calcularFee(precio_usd, categoria, tipoCambio);
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    const analysis: AnalisisCompleto = {
      id,
      timestamp,
      filename: 'Entrada manual',
      extraido: {
        tienda,
        producto,
        numero_orden: numero_orden || null,
        precio_reportado_usd: precio_usd,
        fecha: new Date().toISOString().slice(0, 10),
        categoria_estimada: categoria,
        dimensiones_estimadas: null,
      },
      verificacion: {
        precio_mercado_usd_min: null,
        precio_mercado_usd_max: null,
        fuentes_consultadas: [],
        notas: 'Ingresado manualmente por el staff de Voxoy.',
      },
      score_confianza: 100,
      nivel: 'alta',
      razon_corta: 'Ingreso manual · staff verificado',
      razon_larga: 'Este pedido fue ingresado manualmente por el staff de Voxoy. El precio y categoría fueron verificados directamente.',
      calculo,
      modo: 'manual',
    };

    const db = (env as any).DB;
    if (db) {
      await db
        .prepare(
          'INSERT INTO analyses (id, timestamp, filename, nivel, score, tienda, producto, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          timestamp,
          'Entrada manual',
          'alta',
          100,
          tienda,
          producto,
          JSON.stringify(analysis),
        )
        .run();
    }

    return new Response(JSON.stringify(analysis), { status: 200, headers: HEADERS });
  } catch (err: any) {
    console.error('manual POST error', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: HEADERS });
  }
};

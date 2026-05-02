import Anthropic from '@anthropic-ai/sdk';
import { TIERS, ALTO_VALOR_USD, calcularFee } from './tabulador';
import { nivelDeScore, type AnalisisCompleto, type ProductoExtraido, type VerificacionMercado } from './types';

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `Eres el asistente de Voxoy, una empresa de paquetería P.O. Box que trae paquetes de EE.UU. a México. Tu trabajo es analizar recibos de compra que los clientes suben para que Voxoy traiga sus paquetes desde McAllen.

Tu tarea tiene tres pasos:

1. EXTRAE del PDF los datos: tienda, producto, número de orden, precio en USD, fecha, dimensiones si vienen.

2. CATEGORIZA el producto en uno de estos tiers según su tamaño físico esperado:

${TIERS.map((t) => `- ${t.categoria} (${(t.fee * 100).toFixed(0)}%): ${t.descripcion}. Ejemplos: ${t.ejemplos.join(', ')}.`).join('\n')}

3. VERIFICA el precio reportado contra precios reales de mercado. Usa la herramienta web_search para confirmar el precio actual del producto en la tienda emisora o en el mercado general. Esto es CRÍTICO porque algunos clientes alteran los PDFs para reportar precios menores y pagar menos comisión.

REGLA DE ALTO VALOR: si el precio supera USD $${ALTO_VALOR_USD}, marca alto_valor=true. Voxoy ofrece tarifa preferencial negociada para estos casos, no aplica el tabulador estándar.

DEVUELVE tu respuesta como JSON puro, sin texto adicional, en este formato exacto:

{
  "extraido": {
    "tienda": "string",
    "producto": "string descriptivo",
    "numero_orden": "string o null",
    "precio_reportado_usd": number,
    "fecha": "YYYY-MM-DD o null",
    "categoria_estimada": "una de: chico, chico-medio, medio, medio-grande, grande, extra-grande, maximo",
    "dimensiones_estimadas": "string descriptivo o null"
  },
  "verificacion": {
    "precio_mercado_usd_min": number o null,
    "precio_mercado_usd_max": number o null,
    "fuentes_consultadas": ["lista de tiendas/sitios consultados"],
    "notas": "explicación de la búsqueda"
  },
  "score_confianza": number entre 0 y 100,
  "razon_corta": "frase breve para mostrar (max 80 chars)",
  "razon_larga": "explicación completa para el admin"
}

CÓMO ASIGNAR EL SCORE:
- 90-100: precio reportado coincide con MSRP o rango de mercado, todo congruente.
- 75-89: precio levemente menor (posible promoción legítima), todo lo demás OK.
- 60-74: precio bajo pero podría ser oferta o producto refurbished, requiere mirada.
- 30-59: precio significativamente menor al esperado sin justificación clara.
- 0-29: precio claramente inconsistente, alta probabilidad de alteración.

NUNCA inventes datos. Si algo no se puede leer del PDF, marca null. Si la web search no encuentra el producto, baja el score con honestidad y nota la falta de fuentes.`;

interface ClaudeResponse {
  extraido: ProductoExtraido;
  verificacion: VerificacionMercado;
  score_confianza: number;
  razon_corta: string;
  razon_larga: string;
}

export async function analizarRecibo(
  pdfBase64: string,
  filename: string,
  apiKey: string,
): Promise<AnalisisCompleto> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    tools: [
      {
        type: 'web_search_20250305' as any,
        name: 'web_search',
        max_uses: 3,
      } as any,
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: `Analiza este recibo (archivo: ${filename}). Devuelve SOLO el JSON especificado, sin texto antes ni después, sin bloques de código.`,
          },
        ],
      },
    ],
  });

  const textBlocks = message.content.filter((b) => b.type === 'text');
  const rawText = textBlocks.map((b) => (b as any).text).join('\n');

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude no devolvió JSON parseable. Respuesta: ${rawText.slice(0, 200)}`);
  }

  const parsed: ClaudeResponse = JSON.parse(jsonMatch[0]);
  const calculo = calcularFee(parsed.extraido.precio_reportado_usd, parsed.extraido.categoria_estimada);

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    filename,
    extraido: parsed.extraido,
    verificacion: parsed.verificacion,
    score_confianza: parsed.score_confianza,
    nivel: nivelDeScore(parsed.score_confianza),
    razon_corta: parsed.razon_corta,
    razon_larga: parsed.razon_larga,
    calculo,
    modo: 'ai',
  };
}

export function analisisMock(filename: string): AnalisisCompleto {
  const seed = filename.toLowerCase();
  const isLegitimate = seed.includes('legit') || (!seed.includes('alter') && !seed.includes('fake'));
  const isAltered = seed.includes('alter') || seed.includes('fake');

  if (isAltered) {
    const precio_falso = 350;
    const calculo = calcularFee(precio_falso, 'medio');
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      filename,
      extraido: {
        tienda: 'Best Buy',
        producto: 'MacBook Pro 14" M3 Pro 512GB',
        numero_orden: 'BBY-2026-44821',
        precio_reportado_usd: precio_falso,
        fecha: '2026-04-22',
        categoria_estimada: 'medio',
        dimensiones_estimadas: '32 x 22 x 5 cm',
      },
      verificacion: {
        precio_mercado_usd_min: 1599,
        precio_mercado_usd_max: 1999,
        fuentes_consultadas: ['bestbuy.com', 'apple.com'],
        notas: 'Precio MSRP Apple actual: $1,799. Best Buy lo lista entre $1,599 (oferta) y $1,999.',
      },
      score_confianza: 12,
      nivel: 'sospechoso',
      razon_corta: 'Precio 78% por debajo del mercado. Posible alteración.',
      razon_larga: `El recibo reporta USD $${precio_falso} para una MacBook Pro 14" M3 Pro, cuando el precio real de mercado oscila entre $1,599 y $1,999 USD. Esta diferencia de ~78% es altamente atípica incluso para productos refurbished o en oferta extrema. Recomendación: verificar el producto físicamente antes de entregar y solicitar al cliente comprobante adicional (correo de confirmación de Best Buy directo).`,
      calculo,
      modo: 'mock',
    };
  }

  const precio = 1199;
  const calculo = calcularFee(precio, 'chico');
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    filename,
    extraido: {
      tienda: 'Apple',
      producto: 'iPhone 15 Pro 256GB',
      numero_orden: 'W123456789',
      precio_reportado_usd: precio,
      fecha: '2026-04-28',
      categoria_estimada: 'chico',
      dimensiones_estimadas: '15 x 8 x 1 cm (caja: ~20 x 12 x 6 cm)',
    },
    verificacion: {
      precio_mercado_usd_min: 1099,
      precio_mercado_usd_max: 1199,
      fuentes_consultadas: ['apple.com'],
      notas: 'Precio MSRP Apple coincide exactamente. Producto vendido directamente por Apple.',
    },
    score_confianza: 96,
    nivel: 'alta',
    razon_corta: 'Precio coincide con MSRP de Apple.',
    razon_larga: `Producto y precio congruentes. Apple vende el iPhone 15 Pro 256GB a USD $${precio} directamente, igual al precio reportado en el recibo. Tienda emisora coincide. Recibo aparenta ser legítimo.`,
    calculo,
    modo: 'mock',
  };
}

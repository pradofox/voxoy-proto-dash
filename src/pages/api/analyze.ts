import type { APIRoute } from 'astro';
import { analizarRecibo, analisisMock } from '../../lib/claude';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const env = (locals as any).runtime?.env || (globalThis as any).process?.env || {};
    const apiKey = env.ANTHROPIC_API_KEY;

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

import type { Categoria, CalculoResultado } from './tabulador';

export interface ProductoExtraido {
  tienda: string;
  producto: string;
  numero_orden: string | null;
  precio_reportado_usd: number;
  fecha: string | null;
  categoria_estimada: Categoria;
  dimensiones_estimadas: string | null;
}

export interface VerificacionMercado {
  precio_mercado_usd_min: number | null;
  precio_mercado_usd_max: number | null;
  fuentes_consultadas: string[];
  notas: string;
}

export type NivelConfianza = 'alta' | 'media' | 'baja' | 'sospechoso';

export interface AnalisisCompleto {
  id: string;
  timestamp: number;
  filename: string;
  extraido: ProductoExtraido;
  verificacion: VerificacionMercado;
  score_confianza: number;
  nivel: NivelConfianza;
  razon_corta: string;
  razon_larga: string;
  calculo: CalculoResultado;
  modo: 'ai' | 'mock' | 'manual';
  error?: string;
}

export function nivelDeScore(score: number): NivelConfianza {
  if (score >= 80) return 'alta';
  if (score >= 60) return 'media';
  if (score >= 30) return 'baja';
  return 'sospechoso';
}

export function colorDeNivel(nivel: NivelConfianza): {
  bg: string;
  text: string;
  border: string;
  emoji: string;
  label: string;
} {
  switch (nivel) {
    case 'alta':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        emoji: '✅',
        label: 'Confiable',
      };
    case 'media':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        emoji: '🟡',
        label: 'Verificar',
      };
    case 'baja':
      return {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        emoji: '⚠️',
        label: 'Revisar',
      };
    case 'sospechoso':
      return {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        emoji: '🚨',
        label: 'Alta sospecha',
      };
  }
}

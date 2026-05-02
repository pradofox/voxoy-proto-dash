export type Categoria =
  | 'chico'
  | 'chico-medio'
  | 'medio'
  | 'medio-grande'
  | 'grande'
  | 'extra-grande'
  | 'maximo';

export interface TabuladorTier {
  categoria: Categoria;
  fee: number;
  ejemplos: string[];
  descripcion: string;
}

export const TIERS: TabuladorTier[] = [
  {
    categoria: 'chico',
    fee: 0.17,
    ejemplos: ['cosméticos', 'libros', 'audífonos', 'cargador', 'cables'],
    descripcion: 'Microondas o más pequeño',
  },
  {
    categoria: 'chico-medio',
    fee: 0.2,
    ejemplos: ['mochila', 'palo de golf', 'lámpara mediana', 'gadget mediano'],
    descripcion: 'Caja de zapatos a microondas',
  },
  {
    categoria: 'medio',
    fee: 0.22,
    ejemplos: ['laptop', 'monitor 24"', 'maleta carry-on', 'tablet'],
    descripcion: 'Tamaño laptop / mochila grande',
  },
  {
    categoria: 'medio-grande',
    fee: 0.24,
    ejemplos: ['TV 32"', 'maleta documentada', 'sintetizador'],
    descripcion: 'TV mediana / maleta documentada',
  },
  {
    categoria: 'grande',
    fee: 0.26,
    ejemplos: ['TV 55"', 'silla de oficina', 'bicicleta'],
    descripcion: 'TV grande / silla',
  },
  {
    categoria: 'extra-grande',
    fee: 0.28,
    ejemplos: ['sillón individual', 'mesa pequeña', 'librero'],
    descripcion: 'Mueble individual',
  },
  {
    categoria: 'maximo',
    fee: 0.3,
    ejemplos: ['sillón grande', 'mesa de comedor', 'sofá'],
    descripcion: 'Mueble grande',
  },
];

export const FEE_MINIMO_MXN = 50;
export const TIPO_CAMBIO_USD_MXN = 17.5;
export const ALTO_VALOR_USD = 1500;

export function getTier(categoria: Categoria): TabuladorTier {
  return TIERS.find((t) => t.categoria === categoria) || TIERS[0];
}

export interface CalculoResultado {
  fee_porcentaje: number;
  fee_usd: number;
  fee_mxn: number;
  total_usd: number;
  total_mxn: number;
  precio_mxn: number;
  alto_valor: boolean;
  fee_aplicado: 'tabulador' | 'minimo' | 'preferencial';
}

export function calcularFee(
  precio_usd: number,
  categoria: Categoria,
): CalculoResultado {
  const tier = getTier(categoria);
  const precio_mxn = precio_usd * TIPO_CAMBIO_USD_MXN;
  const alto_valor = precio_usd >= ALTO_VALOR_USD;

  let fee_porcentaje = tier.fee;
  let fee_aplicado: CalculoResultado['fee_aplicado'] = 'tabulador';

  let fee_usd = precio_usd * fee_porcentaje;
  let fee_mxn = fee_usd * TIPO_CAMBIO_USD_MXN;

  if (fee_mxn < FEE_MINIMO_MXN) {
    fee_mxn = FEE_MINIMO_MXN;
    fee_usd = FEE_MINIMO_MXN / TIPO_CAMBIO_USD_MXN;
    fee_aplicado = 'minimo';
  }

  if (alto_valor) {
    fee_aplicado = 'preferencial';
  }

  return {
    fee_porcentaje,
    fee_usd,
    fee_mxn,
    total_usd: precio_usd + fee_usd,
    total_mxn: precio_mxn + fee_mxn,
    precio_mxn,
    alto_valor,
    fee_aplicado,
  };
}

export function formatMXN(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

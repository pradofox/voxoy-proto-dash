import { useState } from 'react';
import { TIERS, calcularFee, formatMXN, formatUSD, TIPO_CAMBIO_USD_MXN } from '../lib/tabulador';
import type { Categoria } from '../lib/tabulador';
import type { CalculoResultado } from '../lib/tabulador';

export interface QuoteSavePayload {
  categoria: Categoria;
  precio_usd: number;
  calculo: CalculoResultado;
}

interface Props {
  tipoCambio?: number;
  onSaveAsManual?: (payload: QuoteSavePayload) => void;
}

export function QuoteCalculator({ tipoCambio = TIPO_CAMBIO_USD_MXN, onSaveAsManual }: Props) {
  const [categoria, setCategoria] = useState<Categoria>('medio');
  const [precioStr, setPrecioStr] = useState('');

  const precio = parseFloat(precioStr) || 0;
  const result = precio > 0 ? calcularFee(precio, categoria, tipoCambio) : null;
  const tier = TIERS.find((t) => t.categoria === categoria)!;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
      {/* Category selector */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-neutral-700 block mb-3">
          Tipo de producto
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.categoria}
              onClick={() => setCategoria(t.categoria)}
              className={`rounded-xl border p-3 text-left transition ${
                categoria === t.categoria
                  ? 'border-voxoy-red bg-red-50 ring-1 ring-voxoy-red'
                  : 'border-neutral-200 bg-neutral-50 hover:border-neutral-300'
              }`}
            >
              <p className="text-xs font-bold text-voxoy-black capitalize leading-tight">
                {t.categoria.replace('-', ' ')}
              </p>
              <p className="text-[10px] text-neutral-500 mt-0.5 leading-tight line-clamp-2">
                {t.descripcion}
              </p>
              <p className="text-sm font-extrabold text-voxoy-red mt-1.5">
                {(t.fee * 100).toFixed(0)}%
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Price input */}
      <div className="mb-6">
        <label className="text-sm font-semibold text-neutral-700 block mb-2">
          Precio del producto en EE.UU.
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-neutral-400 font-semibold select-none">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={precioStr}
            onChange={(e) => setPrecioStr(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-neutral-200 pl-9 pr-20 py-3.5 text-2xl font-bold text-voxoy-black placeholder:text-neutral-300 focus:border-voxoy-red focus:outline-none focus:ring-1 focus:ring-voxoy-red"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-neutral-400 font-medium">USD</span>
        </div>
      </div>

      {/* Result */}
      {result ? (
        <>
          {result.fee_aplicado === 'preferencial' ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 mb-4">
              <p className="font-semibold text-amber-900 mb-1">⭐ Producto de alto valor (+$1,500 USD)</p>
              <p className="text-sm text-amber-800">
                Este producto califica para tarifa preferencial. Contacta a Voxoy para tu cotización personalizada.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-voxoy-red p-5 text-white mb-4">
              <p className="text-xs uppercase tracking-wider opacity-80 mb-1">Comisión Voxoy</p>
              <p className="text-4xl font-extrabold">{formatMXN(result.fee_mxn)}</p>
              <div className="flex items-center gap-4 mt-2 text-sm opacity-80">
                <span>{(result.fee_porcentaje * 100).toFixed(0)}% sobre {formatUSD(precio)}</span>
              </div>
              {result.fee_aplicado === 'minimo' && (
                <p className="text-xs opacity-70 mt-1">(tarifa mínima aplicada)</p>
              )}
            </div>
          )}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm">
            <span className="text-neutral-500">📐 </span>
            <span className="text-neutral-700 font-medium">{tier.dimensiones}</span>
            <span className="text-neutral-400 ml-2">· {tier.descripcion}</span>
          </div>
          {onSaveAsManual && result.fee_aplicado !== 'preferencial' && (
            <button
              onClick={() => onSaveAsManual({ categoria, precio_usd: precio, calculo: result })}
              className="mt-4 w-full rounded-xl border-2 border-dashed border-neutral-300 py-3 text-sm font-semibold text-neutral-600 transition hover:border-voxoy-red hover:text-voxoy-red"
            >
              + Guardar como pedido manual
            </button>
          )}
        </>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-neutral-200 p-8 text-center text-neutral-400 text-sm">
          Ingresa el precio para ver la cotización
        </div>
      )}
    </div>
  );
}

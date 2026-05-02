import { useEffect, useState } from 'react';
import type { AnalisisCompleto, NivelConfianza } from '../lib/types';
import { colorDeNivel } from '../lib/types';
import { formatMXN, formatUSD } from '../lib/tabulador';

const STORAGE_KEY = 'voxoy_history_v1';

type Filter = 'todos' | 'flagueados' | 'confiables';

export default function AdminApp() {
  const [history, setHistory] = useState<AnalisisCompleto[]>([]);
  const [filter, setFilter] = useState<Filter>('todos');
  const [selected, setSelected] = useState<AnalisisCompleto | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) setHistory(JSON.parse(raw));
  }, []);

  const filtered = history.filter((item) => {
    if (filter === 'todos') return true;
    if (filter === 'flagueados') return item.nivel === 'baja' || item.nivel === 'sospechoso';
    if (filter === 'confiables') return item.nivel === 'alta';
    return true;
  });

  const stats = {
    total: history.length,
    flagueados: history.filter((i) => i.nivel === 'baja' || i.nivel === 'sospechoso').length,
    confiables: history.filter((i) => i.nivel === 'alta').length,
    valor_total: history.reduce((s, i) => s + i.calculo.fee_mxn, 0),
  };

  if (history.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 text-center">
        <h1 className="text-3xl font-extrabold text-voxoy-black mb-3">Panel de control</h1>
        <p className="text-neutral-600 mb-8">
          Aún no hay recibos procesados. Sube uno desde la vista cliente para empezar.
        </p>
        <a
          href="/"
          className="inline-block rounded-full bg-voxoy-red px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-voxoy-red-dark"
        >
          Ir a vista cliente
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-voxoy-black mb-1">Panel de control</h1>
        <p className="text-neutral-600">Recibos procesados y nivel de confianza por la AI.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard label="Total" value={stats.total.toString()} />
        <StatCard label="Confiables" value={stats.confiables.toString()} accent="emerald" />
        <StatCard label="Flagueados" value={stats.flagueados.toString()} accent="red" />
        <StatCard label="Comisiones" value={formatMXN(stats.valor_total)} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill active={filter === 'todos'} onClick={() => setFilter('todos')}>
          Todos ({history.length})
        </FilterPill>
        <FilterPill active={filter === 'flagueados'} onClick={() => setFilter('flagueados')}>
          🚨 Flagueados ({stats.flagueados})
        </FilterPill>
        <FilterPill active={filter === 'confiables'} onClick={() => setFilter('confiables')}>
          ✅ Confiables ({stats.confiables})
        </FilterPill>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <ReciboRow key={item.id} item={item} onClick={() => setSelected(item)} />
        ))}
      </div>

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'red';
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'red'
        ? 'text-voxoy-red'
        : 'text-voxoy-black';
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: any;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-voxoy-red bg-voxoy-red text-white'
          : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
      }`}
    >
      {children}
    </button>
  );
}

function ReciboRow({
  item,
  onClick,
}: {
  item: AnalisisCompleto;
  onClick: () => void;
}) {
  const colors = colorDeNivel(item.nivel);
  const fecha = new Date(item.timestamp).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition hover:shadow-sm ${colors.border} ${colors.bg}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{colors.emoji}</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
              {colors.label}
            </span>
            <span className="text-xs text-neutral-500">{item.score_confianza}%</span>
          </div>
          <p className="text-xs text-neutral-500 mb-0.5">{item.extraido.tienda}</p>
          <p className="font-semibold text-voxoy-black truncate">{item.extraido.producto}</p>
          <p className={`text-sm mt-1 ${colors.text}`}>{item.razon_corta}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-neutral-500">{fecha}</p>
          <p className="font-bold text-voxoy-black mt-1">
            {formatUSD(item.extraido.precio_reportado_usd)}
          </p>
          <p className="text-xs text-neutral-600">comisión {formatMXN(item.calculo.fee_mxn)}</p>
        </div>
      </div>
    </button>
  );
}

function DetailModal({ item, onClose }: { item: AnalisisCompleto; onClose: () => void }) {
  const colors = colorDeNivel(item.nivel);
  const { extraido, verificacion, calculo } = item;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`border-b ${colors.border} ${colors.bg} p-6`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{colors.emoji}</span>
                <span className={`text-sm font-semibold uppercase tracking-wider ${colors.text}`}>
                  {colors.label} - {item.score_confianza}%
                </span>
              </div>
              <p className="text-xs text-neutral-600 mb-1">{extraido.tienda}</p>
              <h2 className="text-xl font-bold text-voxoy-black">{extraido.producto}</h2>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <Section title="Análisis de la AI">
            <p className="text-sm text-neutral-700 leading-relaxed">{item.razon_larga}</p>
          </Section>

          <div className="grid grid-cols-2 gap-4">
            <DataPoint label="Precio reportado" value={formatUSD(extraido.precio_reportado_usd)} />
            <DataPoint
              label="Precio mercado"
              value={
                verificacion.precio_mercado_usd_min && verificacion.precio_mercado_usd_max
                  ? `${formatUSD(verificacion.precio_mercado_usd_min)} - ${formatUSD(verificacion.precio_mercado_usd_max)}`
                  : 'no disponible'
              }
            />
            <DataPoint label="Categoría" value={extraido.categoria_estimada} />
            <DataPoint label="Tarifa aplicada" value={`${(calculo.fee_porcentaje * 100).toFixed(0)}%`} />
            {extraido.numero_orden && <DataPoint label="Número de orden" value={extraido.numero_orden} />}
            {extraido.fecha && <DataPoint label="Fecha" value={extraido.fecha} />}
          </div>

          {verificacion.fuentes_consultadas?.length > 0 && (
            <Section title="Fuentes consultadas">
              <ul className="text-sm text-neutral-600 list-disc list-inside">
                {verificacion.fuentes_consultadas.map((f) => (
                  <li>{f}</li>
                ))}
              </ul>
              {verificacion.notas && (
                <p className="text-xs text-neutral-500 mt-2 italic">{verificacion.notas}</p>
              )}
            </Section>
          )}

          <div className="rounded-xl bg-neutral-50 p-5">
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Comisión a cobrar al cliente
            </p>
            <p className="text-3xl font-extrabold text-voxoy-black">
              {formatMXN(calculo.fee_mxn)}
            </p>
            <p className="text-sm text-neutral-600 mt-1">
              {(calculo.fee_porcentaje * 100).toFixed(0)}% sobre {formatMXN(calculo.precio_mxn)} · producto ya pagado en EE.UU.
            </p>
          </div>

          {(item.nivel === 'baja' || item.nivel === 'sospechoso') && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-5">
              <p className="text-sm font-semibold text-red-900 mb-2">Acciones recomendadas</p>
              <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                <li>Verificar producto físicamente al recibir</li>
                <li>Solicitar al cliente comprobante adicional (correo de confirmación de la tienda)</li>
                <li>No entregar hasta confirmar autenticidad</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2 font-semibold">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-voxoy-black">{value}</p>
    </div>
  );
}

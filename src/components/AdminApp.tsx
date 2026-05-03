import { useEffect, useState } from 'react';
import type { AnalisisCompleto, EstadoPedido, NivelConfianza } from '../lib/types';
import { colorDeNivel } from '../lib/types';
import { formatMXN, formatUSD, getTier } from '../lib/tabulador';

type Filter = 'todos' | 'flagueados' | 'confiables' | 'pendientes';

// ── helpers ────────────────────────────────────────────────────────────────

function calcFraudeDetectado(history: AnalisisCompleto[]): number {
  return history
    .filter(
      (i) =>
        (i.nivel === 'sospechoso' || i.nivel === 'baja') &&
        i.verificacion.precio_mercado_usd_min != null &&
        i.verificacion.precio_mercado_usd_max != null,
    )
    .reduce((sum, i) => {
      const mid =
        (i.verificacion.precio_mercado_usd_min! + i.verificacion.precio_mercado_usd_max!) / 2;
      const diff = mid - i.extraido.precio_reportado_usd;
      return sum + (diff > 0 ? diff : 0);
    }, 0);
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdminApp() {
  const [history, setHistory] = useState<AnalisisCompleto[]>([]);
  const [filter, setFilter] = useState<Filter>('todos');
  const [selected, setSelected] = useState<AnalisisCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch (e) {
      console.error('Error cargando historial', e);
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    if (!confirm('¿Borrar todo el historial? Esta acción no se puede deshacer.')) return;
    setClearing(true);
    try {
      await fetch('/api/history', { method: 'DELETE' });
      setHistory([]);
      setSelected(null);
    } finally {
      setClearing(false);
    }
  }

  function handleStatusChange(id: string, status: EstadoPedido) {
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, _status: status } : item)),
    );
    setSelected((prev) => (prev?.id === id ? { ...prev, _status: status } : prev));
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  const filtered = history.filter((item) => {
    if (filter === 'flagueados') return item.nivel === 'baja' || item.nivel === 'sospechoso';
    if (filter === 'confiables') return item.nivel === 'alta';
    if (filter === 'pendientes') return !item._status || item._status === 'pendiente';
    return true;
  });

  const stats = {
    total: history.length,
    flagueados: history.filter((i) => i.nivel === 'baja' || i.nivel === 'sospechoso').length,
    confiables: history.filter((i) => i.nivel === 'alta').length,
    comisiones: history.reduce((s, i) => s + i.calculo.fee_mxn, 0),
    fraude_usd: calcFraudeDetectado(history),
    pendientes: history.filter((i) => !i._status || i._status === 'pendiente').length,
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-voxoy-red" />
        <p className="text-neutral-500">Cargando recibos...</p>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (history.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 text-center">
        <h1 className="text-3xl font-extrabold text-voxoy-black mb-3">Panel de control</h1>
        <p className="text-neutral-600 mb-8">
          Aún no hay recibos procesados. Sube uno desde la vista cliente para empezar.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a
            href="/"
            className="rounded-full bg-voxoy-red px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-voxoy-red-dark"
          >
            Ir a vista cliente
          </a>
          <button
            onClick={fetchHistory}
            className="rounded-full border border-neutral-300 px-6 py-3 font-semibold text-neutral-700 transition hover:border-neutral-400"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }

  // ── Main dashboard ───────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 sm:px-6">

      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-voxoy-black mb-0.5">
            Panel de control
          </h1>
          <p className="text-sm text-neutral-600">Recibos procesados · confianza por AI</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={fetchHistory}
            className="flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
            title="Recargar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span className="hidden sm:inline">Recargar</span>
          </button>
          <button
            onClick={clearHistory}
            disabled={clearing}
            className="flex items-center gap-1.5 rounded-full border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            title="Limpiar todo"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            <span className="hidden sm:inline">{clearing ? 'Borrando...' : 'Limpiar'}</span>
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total" value={stats.total.toString()} />
        <StatCard label="Pendientes" value={stats.pendientes.toString()} accent="amber" />
        <StatCard label="Confiables" value={stats.confiables.toString()} accent="emerald" />
        <StatCard label="Flagueados" value={stats.flagueados.toString()} accent="red" />
        <StatCard
          label="Fraude detectado"
          value={stats.fraude_usd > 0 ? formatUSD(stats.fraude_usd) : '—'}
          accent={stats.fraude_usd > 0 ? 'red' : undefined}
          sub={stats.fraude_usd > 0 ? 'subdeclarado vs mercado' : 'sin alteraciones'}
          colSpan
        />
      </div>

      {/* Comisiones total */}
      {stats.comisiones > 0 && (
        <div className="mb-6 rounded-xl bg-voxoy-black px-5 py-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-neutral-400">Comisiones acumuladas</p>
          <p className="text-xl font-extrabold text-white">{formatMXN(stats.comisiones)}</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterPill active={filter === 'todos'} onClick={() => setFilter('todos')}>
          Todos ({history.length})
        </FilterPill>
        <FilterPill active={filter === 'pendientes'} onClick={() => setFilter('pendientes')}>
          🕐 Pendientes ({stats.pendientes})
        </FilterPill>
        <FilterPill active={filter === 'flagueados'} onClick={() => setFilter('flagueados')}>
          🚨 Flagueados ({stats.flagueados})
        </FilterPill>
        <FilterPill active={filter === 'confiables'} onClick={() => setFilter('confiables')}>
          ✅ Confiables ({stats.confiables})
        </FilterPill>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map((item) => (
          <ReciboRow key={item.id} item={item} onClick={() => setSelected(item)} />
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-10 text-neutral-500 text-sm">No hay recibos en este filtro.</p>
        )}
      </div>

      {selected && (
        <DetailModal
          item={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
  sub,
  colSpan,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'red' | 'amber';
  sub?: string;
  colSpan?: boolean;
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'red'
        ? 'text-voxoy-red'
        : accent === 'amber'
          ? 'text-amber-600'
          : 'text-voxoy-black';
  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-4 ${colSpan ? 'col-span-2 sm:col-span-1 lg:col-span-1' : ''}`}>
      <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${accentClass} leading-tight`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── FilterPill ─────────────────────────────────────────────────────────────

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: any }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-voxoy-red bg-voxoy-red text-white'
          : 'border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400'
      }`}
    >
      {children}
    </button>
  );
}

// ── Status helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EstadoPedido, { label: string; emoji: string; pill: string }> = {
  pendiente: { label: 'Pendiente', emoji: '🕐', pill: 'bg-neutral-100 text-neutral-600' },
  entregado: { label: 'Entregado', emoji: '✅', pill: 'bg-emerald-100 text-emerald-700' },
  rechazado: { label: 'Rechazado', emoji: '❌', pill: 'bg-red-100 text-red-700' },
};

// ── ReciboRow ──────────────────────────────────────────────────────────────

function ReciboRow({ item, onClick }: { item: AnalisisCompleto; onClick: () => void }) {
  const colors = colorDeNivel(item.nivel);
  const estado = item._status ?? 'pendiente';
  const statusCfg = STATUS_CONFIG[estado];
  const fecha = new Date(item.timestamp).toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 sm:p-4 transition hover:shadow-sm ${colors.border} ${colors.bg}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-base">{colors.emoji}</span>
            <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
              {colors.label}
            </span>
            <span className="text-xs text-neutral-400">{item.score_confianza}%</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.pill}`}>
              {statusCfg.emoji} {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-neutral-500 truncate">{item.extraido.tienda}</p>
          <p className="font-semibold text-voxoy-black text-sm truncate">{item.extraido.producto}</p>
          <p className={`text-xs mt-0.5 ${colors.text} line-clamp-1`}>{item.razon_corta}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-neutral-400">{fecha}</p>
          <p className="font-bold text-voxoy-black text-sm mt-0.5">
            {formatUSD(item.extraido.precio_reportado_usd)}
          </p>
          <p className="text-xs text-neutral-500">
            comisión {formatMXN(item.calculo.fee_mxn)}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── DetailModal ────────────────────────────────────────────────────────────

function DetailModal({
  item,
  onClose,
  onStatusChange,
}: {
  item: AnalisisCompleto;
  onClose: () => void;
  onStatusChange: (id: string, status: EstadoPedido) => void;
}) {
  const colors = colorDeNivel(item.nivel);
  const { extraido, verificacion, calculo } = item;
  const [updating, setUpdating] = useState(false);

  // Lock body scroll while modal is open (fixes iOS bounce bleed)
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  async function setStatus(status: EstadoPedido) {
    setUpdating(true);
    try {
      await fetch('/api/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status }),
      });
      onStatusChange(item.id, status);
    } finally {
      setUpdating(false);
    }
  }

  const estadoActual = item._status ?? 'pendiente';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full sm:max-w-2xl overflow-y-auto overscroll-contain rounded-t-2xl sm:rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className={`border-b ${colors.border} ${colors.bg} p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="text-xl">{colors.emoji}</span>
                <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                  {colors.label} · {item.score_confianza}%
                </span>
              </div>
              <p className="text-xs text-neutral-500 mb-0.5">{extraido.tienda}</p>
              <h2 className="text-lg font-bold text-voxoy-black leading-tight">{extraido.producto}</h2>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 text-xl shrink-0">
              ✕
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Estado del pedido ─────────────────────────────────── */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Estado del pedido
            </p>
            <div className="flex gap-2 flex-wrap">
              {(['pendiente', 'entregado', 'rechazado'] as EstadoPedido[]).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const isActive = estadoActual === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    disabled={updating || isActive}
                    className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? s === 'entregado'
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : s === 'rechazado'
                            ? 'bg-red-600 border-red-600 text-white'
                            : 'bg-neutral-700 border-neutral-700 text-white'
                        : 'border-neutral-300 text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50'
                    } disabled:cursor-default`}
                  >
                    {cfg.emoji} {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Comisión ──────────────────────────────────────────── */}
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

          {/* ── Comparativa de precios ────────────────────────────── */}
          <PriceComparisonCard extraido={extraido} verificacion={verificacion} />

          {/* ── Categoría + dimensiones ───────────────────────────── */}
          <TierCard categoria={extraido.categoria_estimada} feePct={calculo.fee_porcentaje} />

          {/* ── Alertas ───────────────────────────────────────────── */}
          {(item.nivel === 'baja' || item.nivel === 'sospechoso') && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <p className="text-sm font-semibold text-red-900 mb-2">Acciones recomendadas</p>
              <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                <li>Verificar producto físicamente al recibir</li>
                <li>Solicitar comprobante adicional (correo de confirmación de la tienda)</li>
                <li>No entregar hasta confirmar autenticidad</li>
              </ul>
            </div>
          )}

          {/* ── Análisis ──────────────────────────────────────────── */}
          <Section title="Análisis de la AI">
            <p className="text-sm text-neutral-700 leading-relaxed">{item.razon_larga}</p>
          </Section>

          {/* ── Datos adicionales ─────────────────────────────────── */}
          {(extraido.numero_orden || extraido.fecha) && (
            <div className="grid grid-cols-2 gap-4">
              {extraido.numero_orden && <DataPoint label="Número de orden" value={extraido.numero_orden} />}
              {extraido.fecha && <DataPoint label="Fecha del recibo" value={extraido.fecha} />}
            </div>
          )}

          {/* ── Fuentes ───────────────────────────────────────────── */}
          {verificacion.fuentes_consultadas?.length > 0 && (
            <Section title="Fuentes consultadas">
              <ul className="text-sm text-neutral-600 list-disc list-inside space-y-0.5">
                {verificacion.fuentes_consultadas.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {verificacion.notas && (
                <p className="text-xs text-neutral-500 mt-2 italic">{verificacion.notas}</p>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PriceComparisonCard ────────────────────────────────────────────────────

function PriceComparisonCard({
  extraido,
  verificacion,
}: {
  extraido: AnalisisCompleto['extraido'];
  verificacion: AnalisisCompleto['verificacion'];
}) {
  const tieneRango =
    verificacion.precio_mercado_usd_min != null && verificacion.precio_mercado_usd_max != null;

  const precioMedio = tieneRango
    ? (verificacion.precio_mercado_usd_min! + verificacion.precio_mercado_usd_max!) / 2
    : null;

  const diferenciaPct =
    precioMedio && precioMedio > 0
      ? ((precioMedio - extraido.precio_reportado_usd) / precioMedio) * 100
      : null;

  const isOk = diferenciaPct === null || Math.abs(diferenciaPct) <= 10;
  const isAmber = !isOk && Math.abs(diferenciaPct!) <= 35;

  const badgeBg = isOk ? 'bg-emerald-50' : isAmber ? 'bg-amber-50' : 'bg-red-50';
  const badgeText = isOk ? 'text-emerald-800' : isAmber ? 'text-amber-800' : 'text-red-800';
  const emoji = isOk ? '✅' : isAmber ? '⚠️' : '🚨';
  const label = isOk
    ? 'Precio coincide con el mercado'
    : `${diferenciaPct!.toFixed(0)}% por debajo del precio de mercado`;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
        Comparativa de precio
      </p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wider text-neutral-400 mb-1">Reportado</p>
          <p className="text-xl font-extrabold text-voxoy-black">
            {formatUSD(extraido.precio_reportado_usd)}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wider text-neutral-400 mb-1">Mercado</p>
          {tieneRango ? (
            <>
              <p className="text-xl font-extrabold text-voxoy-black">
                {formatUSD(verificacion.precio_mercado_usd_min!)}
              </p>
              {verificacion.precio_mercado_usd_min !== verificacion.precio_mercado_usd_max && (
                <p className="text-xs text-neutral-500">- {formatUSD(verificacion.precio_mercado_usd_max!)}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-400 italic mt-1">no disponible</p>
          )}
        </div>
      </div>
      <div className={`rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${badgeBg} ${badgeText}`}>
        <span>{emoji}</span>
        <span>{label}</span>
      </div>
    </div>
  );
}

// ── TierCard ───────────────────────────────────────────────────────────────

function TierCard({ categoria, feePct }: { categoria: string; feePct: number }) {
  const tier = getTier(categoria as any);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
        Categoría · justificación del {(feePct * 100).toFixed(0)}%
      </p>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-bold text-voxoy-black capitalize">{tier.categoria}</p>
          <p className="text-sm text-neutral-600">{tier.descripcion}</p>
          <p className="text-sm text-neutral-500 mt-1">📐 {tier.dimensiones}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-extrabold text-voxoy-black">{(feePct * 100).toFixed(0)}%</p>
          <p className="text-xs text-neutral-500">tarifa</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tier.ejemplos.map((e) => (
          <span key={e} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600">
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Section / DataPoint ────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2 font-semibold">{title}</h3>
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

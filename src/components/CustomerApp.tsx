import { useEffect, useRef, useState } from 'react';
import type { AnalisisCompleto } from '../lib/types';
import { formatMXN, formatUSD, getTier } from '../lib/tabulador';

const STORAGE_KEY = 'voxoy_history_v1';
const MAX_HISTORY = 20;

type AppState =
  | { status: 'idle' }
  | { status: 'loading'; filename: string }
  | { status: 'result'; data: AnalisisCompleto }
  | { status: 'error'; message: string };

function saveToHistory(item: AnalisisCompleto) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: AnalisisCompleto[] = raw ? JSON.parse(raw) : [];
    list.unshift(item);
    const trimmed = list.slice(0, MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('No se pudo guardar en historial', e);
  }
}

function readHistory(): AnalisisCompleto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function CustomerApp() {
  const [state, setState] = useState<AppState>({ status: 'idle' });
  const [history, setHistory] = useState<AnalisisCompleto[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  async function processFile(file: File) {
    setState({ status: 'loading', filename: file.name });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/analyze', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (data.id) {
          saveToHistory(data);
          setHistory(readHistory());
          setState({ status: 'result', data });
          return;
        }
        throw new Error(data.error || 'Error procesando el recibo');
      }
      saveToHistory(data);
      setHistory(readHistory());
      setState({ status: 'result', data });
    } catch (err: any) {
      setState({ status: 'error', message: err?.message || 'Error desconocido' });
    }
  }

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function reset() {
    setState({ status: 'idle' });
  }

  function clearHistory() {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }

  function loadFromHistory(item: AnalisisCompleto) {
    setState({ status: 'result', data: item });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {state.status === 'idle' && (
        <IdleView
          onSelectFile={onSelectFile}
          onDrop={onDrop}
          dragOver={dragOver}
          setDragOver={setDragOver}
          inputRef={inputRef}
        />
      )}
      {state.status === 'loading' && <LoadingView filename={state.filename} />}
      {state.status === 'result' && <ResultView data={state.data} onReset={reset} />}
      {state.status === 'error' && <ErrorView message={state.message} onReset={reset} />}

      {history.length > 0 && state.status === 'idle' && (
        <HistoryPanel history={history} onClear={clearHistory} onSelect={loadFromHistory} />
      )}

      {state.status === 'idle' && <OrderStatusLookup />}
    </div>
  );
}

function IdleView({
  onSelectFile,
  onDrop,
  dragOver,
  setDragOver,
  inputRef,
}: {
  onSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-voxoy-black mb-4">
          Calcula tu envío <span className="text-voxoy-red">al instante</span>
        </h1>
        <p className="text-lg text-neutral-600 max-w-xl mx-auto">
          Sube el recibo de tu compra en EE.UU. y descubre cuánto te cuesta traerlo a México.
          Sin esperas, sin sorpresas.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragOver
            ? 'border-voxoy-red bg-red-50'
            : 'border-neutral-300 bg-neutral-50 hover:border-neutral-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={onSelectFile}
          className="hidden"
          id="file-upload"
        />
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-white p-4 shadow-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="h-10 w-10 text-voxoy-red"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-semibold text-voxoy-black mb-2">
          Arrastra tu recibo aquí
        </h2>
        <p className="text-neutral-600 mb-6 text-sm">PDF de cualquier tienda de EE.UU. (max 10MB)</p>
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-voxoy-red px-8 py-3 font-semibold text-white shadow-sm transition hover:bg-voxoy-red-dark"
        >
          Seleccionar recibo
        </button>
        <p className="mt-6 text-xs text-neutral-400">
          Demo. Nada se guarda en servidor.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        <FeatureCard
          icon="🤖"
          title="Lectura automática"
          desc="Extraemos producto, tienda y precio en segundos."
        />
        <FeatureCard
          icon="🎯"
          title="Tarifa precisa"
          desc="Aplicamos el tabulador real de Voxoy automáticamente."
        />
        <FeatureCard
          icon="🔒"
          title="Verificación de mercado"
          desc="Validamos el precio contra fuentes reales."
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-6">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-voxoy-black mb-1">{title}</h3>
      <p className="text-sm text-neutral-600">{desc}</p>
    </div>
  );
}

function LoadingView({ filename }: { filename: string }) {
  const [step, setStep] = useState(0);
  const steps = [
    'Leyendo el recibo...',
    'Identificando el producto...',
    'Verificando precio en el mercado...',
    'Calculando tu tarifa...',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % steps.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-2xl bg-neutral-50 p-12 text-center">
      <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-neutral-200 border-t-voxoy-red"></div>
      <h2 className="text-xl font-semibold text-voxoy-black mb-2">{steps[step]}</h2>
      <p className="text-sm text-neutral-500 truncate">{filename}</p>
    </div>
  );
}

function ResultView({ data, onReset }: { data: AnalisisCompleto; onReset: () => void }) {
  const { extraido, calculo } = data;
  const tier = getTier(extraido.categoria_estimada);
  const isAltoValor = calculo.fee_aplicado === 'preferencial';

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onReset}
          className="text-sm font-medium text-neutral-600 transition hover:text-voxoy-red"
        >
          ← Otro recibo
        </button>
        {data.modo === 'mock' && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            Modo demo (sin API)
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-neutral-500">
          {extraido.tienda}
        </div>
        <h2 className="text-2xl font-bold text-voxoy-black mb-1">{extraido.producto}</h2>
        {extraido.numero_orden && (
          <p className="text-sm text-neutral-500 mb-6">Orden #{extraido.numero_orden}</p>
        )}

        <div className="my-8 grid grid-cols-2 gap-4 border-y border-neutral-100 py-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Precio del producto</p>
            <p className="text-2xl font-bold text-voxoy-black">{formatUSD(extraido.precio_reportado_usd)}</p>
            <p className="text-sm text-neutral-500">{formatMXN(calculo.precio_mxn)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
              Categoría {tier.categoria}
            </p>
            <p className="text-2xl font-bold text-voxoy-black">
              {(calculo.fee_porcentaje * 100).toFixed(0)}%
            </p>
            <p className="text-sm text-neutral-500">{tier.descripcion}</p>
          </div>
        </div>

        {isAltoValor ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 mb-6">
            <p className="text-sm font-semibold text-amber-900 mb-2">⭐ Producto de alto valor</p>
            <p className="text-sm text-amber-800">
              Este producto califica para tarifa preferencial. Contacta a Voxoy para tu cotización
              personalizada.
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-neutral-50 p-5 mb-6">
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Comisión de Voxoy
            </p>
            <p className="text-3xl font-bold text-voxoy-black">{formatMXN(calculo.fee_mxn)}</p>
            {calculo.fee_aplicado === 'minimo' && (
              <p className="text-xs text-neutral-500 mt-1">(tarifa mínima aplicada)</p>
            )}
          </div>
        )}

        <div className="rounded-xl bg-voxoy-red p-6 text-white">
          <p className="text-xs uppercase tracking-wider opacity-80 mb-1">
            {isAltoValor ? 'Costo estimado del producto' : 'Lo que pagas al recoger'}
          </p>
          <p className="text-4xl font-extrabold">
            {isAltoValor ? formatMXN(calculo.precio_mxn) : formatMXN(calculo.fee_mxn)}
          </p>
          <p className="text-sm opacity-80 mt-1">
            {isAltoValor
              ? 'Comisión a negociar con Voxoy'
              : 'Solo la comisión. El producto ya lo pagaste en EE.UU.'}
          </p>
        </div>
      </div>

      <div className="mt-6 text-center text-sm text-neutral-500">
        <p>Cuando llegue tu paquete a McAllen te avisamos por correo.</p>
        <p className="mt-1">Pasas a recoger a tu sucursal y pagas en efectivo.</p>
      </div>
    </div>
  );
}

function ErrorView({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <div className="text-4xl mb-3">😕</div>
      <h2 className="text-xl font-semibold text-red-900 mb-2">No pudimos leer este recibo</h2>
      <p className="text-sm text-red-700 mb-6">{message}</p>
      <button
        onClick={onReset}
        className="rounded-full bg-voxoy-red px-6 py-2 font-semibold text-white transition hover:bg-voxoy-red-dark"
      >
        Intentar otro recibo
      </button>
    </div>
  );
}

// ── Order Status Lookup ────────────────────────────────────────────────────

type PedidoResult =
  | { found: false }
  | { found: true; tienda: string; producto: string; precio_usd: number; fee_mxn: number; status: 'pendiente' | 'entregado' | 'rechazado'; timestamp: number };

const STATUS_INFO = {
  pendiente: {
    emoji: '🕐',
    label: 'En proceso',
    desc: 'Tu paquete está siendo procesado. Te avisaremos cuando esté listo para recoger.',
    color: 'bg-amber-50 border-amber-200 text-amber-900',
  },
  entregado: {
    emoji: '✅',
    label: 'Listo para recoger',
    desc: 'Tu paquete llegó al PO Box Voxoy. Pasa a recogerlo de lunes a sábado 9am - 6pm.',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  },
  rechazado: {
    emoji: '❌',
    label: 'Rechazado',
    desc: 'Tu pedido no pudo ser procesado. Contacta a Voxoy para más información.',
    color: 'bg-red-50 border-red-200 text-red-900',
  },
};

function OrderStatusLookup() {
  const [orden, setOrden] = useState('');
  const [result, setResult] = useState<PedidoResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function consultar() {
    const q = orden.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/pedido?orden=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ found: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-12 border-t border-neutral-200 pt-8">
      <h3 className="text-sm font-semibold text-neutral-700 mb-1">¿Ya tienes un pedido con Voxoy?</h3>
      <p className="text-xs text-neutral-500 mb-4">Consulta el estado de tu paquete con el número de orden de tu tienda.</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={orden}
          onChange={(e) => { setOrden(e.target.value); setResult(null); }}
          onKeyDown={(e) => e.key === 'Enter' && consultar()}
          placeholder="Ej. W123456789 · BBY01-806-46-..."
          className="flex-1 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-voxoy-red focus:outline-none focus:ring-1 focus:ring-voxoy-red"
        />
        <button
          onClick={consultar}
          disabled={loading || !orden.trim()}
          className="rounded-xl bg-voxoy-red px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-voxoy-red-dark disabled:opacity-50"
        >
          {loading ? '...' : 'Consultar'}
        </button>
      </div>

      {result !== null && (
        <div className="mt-4">
          {!result.found ? (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
              No encontramos un pedido con ese número de orden. Verifica que sea el número exacto de tu confirmación de compra.
            </div>
          ) : (
            <div className={`rounded-xl border p-4 ${STATUS_INFO[result.status].color}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl">{STATUS_INFO[result.status].emoji}</span>
                <div>
                  <p className="font-semibold">{STATUS_INFO[result.status].label}</p>
                  <p className="text-xs mt-0.5 opacity-80">{result.tienda} · {result.producto}</p>
                  <p className="text-sm mt-2">{STATUS_INFO[result.status].desc}</p>
                  {result.status === 'entregado' && (
                    <p className="text-sm font-semibold mt-2">
                      Comisión a pagar: {formatMXN(result.fee_mxn)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  history,
  onClear,
  onSelect,
}: {
  history: AnalisisCompleto[];
  onClear: () => void;
  onSelect: (item: AnalisisCompleto) => void;
}) {
  return (
    <div className="mt-12 border-t border-neutral-200 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">
          Recibos recientes ({history.length})
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-neutral-500 transition hover:text-voxoy-red"
        >
          Limpiar historial
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {history.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="text-left rounded-lg border border-neutral-200 bg-white p-3 transition hover:border-voxoy-red hover:shadow-sm"
          >
            <p className="text-xs text-neutral-500 truncate">{item.extraido.tienda}</p>
            <p className="text-sm font-medium text-voxoy-black truncate">{item.extraido.producto}</p>
            <p className="text-sm text-voxoy-red font-semibold mt-1">
              {formatMXN(item.calculo.fee_mxn)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

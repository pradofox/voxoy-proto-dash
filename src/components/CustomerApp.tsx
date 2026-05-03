import { useEffect, useRef, useState } from 'react';
import type { AnalisisCompleto, EstadoPedido } from '../lib/types';
import { formatMXN, formatUSD, getTier } from '../lib/tabulador';
import { QuoteCalculator } from './QuoteCalculator';

const CONTACT_KEY = 'voxoy_contact_v1';

const STORAGE_KEY = 'voxoy_history_v1';
const MAX_HISTORY = 20;

interface ContactInfo { nombre: string; whatsapp: string }

function readContact(): ContactInfo | null {
  try { const r = localStorage.getItem(CONTACT_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveContact(c: ContactInfo) {
  try { localStorage.setItem(CONTACT_KEY, JSON.stringify(c)); } catch {}
}

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
  const [statusMap, setStatusMap] = useState<Record<string, EstadoPedido>>({});
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [contactPrompted, setContactPrompted] = useState(false); // don't re-ask same session
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function fetchStatuses(ids: string[]) {
    if (ids.length === 0) return;
    try {
      const res = await fetch(`/api/statuses?ids=${ids.join(',')}`);
      const map = await res.json();
      setStatusMap((prev) => ({ ...prev, ...map }));
    } catch {
      // non-fatal
    }
  }

  useEffect(() => {
    const h = readHistory();
    setHistory(h);
    fetchStatuses(h.map((i) => i.id).filter(Boolean));
    setContact(readContact());
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
          setStatusMap((prev) => ({ ...prev, [data.id]: 'pendiente' }));
          setState({ status: 'result', data });
          return;
        }
        throw new Error(data.error || 'Error procesando el recibo');
      }
      saveToHistory(data);
      setHistory(readHistory());
      setStatusMap((prev) => ({ ...prev, [data.id]: 'pendiente' }));
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
    // Refresh this item's status from D1 when opened
    fetchStatuses([item.id]);
  }

  async function handleSaveContact(c: ContactInfo, analysisId: string) {
    saveContact(c);
    setContact(c);
    setContactPrompted(true);
    try {
      await fetch('/api/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: analysisId, contact: c }),
      });
    } catch {}
  }

  const currentStatus = state.status === 'result' ? (statusMap[state.data.id] ?? 'pendiente') : undefined;
  const showContactPrompt = state.status === 'result' && !contact && !contactPrompted;

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
      {state.status === 'result' && (
        <ResultView
          data={state.data}
          onReset={reset}
          currentStatus={currentStatus}
          showContactPrompt={showContactPrompt}
          onSaveContact={(c) => handleSaveContact(c, state.data.id)}
          onDismissContact={() => setContactPrompted(true)}
        />
      )}
      {state.status === 'error' && <ErrorView message={state.message} onReset={reset} />}

      {history.length > 0 && state.status === 'idle' && (
        <HistoryPanel history={history} onClear={clearHistory} onSelect={loadFromHistory} statusMap={statusMap} />
      )}

      {state.status === 'idle' && (
        <OrderStatusLookup
          contact={contact}
          onEditContact={(c) => { saveContact(c); setContact(c); }}
        />
      )}
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
  const [mode, setMode] = useState<'recibo' | 'calculadora'>('recibo');

  return (
    <div>
      <div className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-voxoy-black mb-4">
          Calcula tu envío <span className="text-voxoy-red">al instante</span>
        </h1>
        <p className="text-lg text-neutral-600 max-w-xl mx-auto">
          Sube tu recibo de EE.UU. o ingresa el precio directamente.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1 mb-6">
        <button
          onClick={() => setMode('recibo')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 ${
            mode === 'recibo' ? 'bg-white shadow-sm text-voxoy-black' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          Subir recibo PDF
        </button>
        <button
          onClick={() => setMode('calculadora')}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 ${
            mode === 'calculadora' ? 'bg-white shadow-sm text-voxoy-black' : 'text-neutral-500 hover:text-neutral-700'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25v-.008Zm2.498-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008v-.008Zm2.498-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008v-.008ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z" />
          </svg>
          Cotización rápida
        </button>
      </div>

      {mode === 'recibo' ? (
        <>
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

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
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
        </>
      ) : (
        <QuoteCalculator />
      )}
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

const RESULT_STATUS_INFO: Record<EstadoPedido, { emoji: string; label: string; desc: string; bg: string; text: string; border: string }> = {
  pendiente: {
    emoji: '🕐',
    label: 'Pedido en proceso',
    desc: 'Recibirás aviso cuando tu paquete llegue a McAllen.',
    bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200',
  },
  en_pobox: {
    emoji: '📦',
    label: 'Tu paquete llegó a McAllen',
    desc: 'Pasa a recogerlo a tu sucursal Voxoy de lunes a sábado 9am - 6pm.',
    bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200',
  },
  entregado: {
    emoji: '✅',
    label: 'Entregado',
    desc: 'Este paquete ya fue recogido.',
    bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-200',
  },
  rechazado: {
    emoji: '❌',
    label: 'Pedido rechazado',
    desc: 'Este pedido no pudo ser procesado. Contacta a Voxoy.',
    bg: 'bg-red-50', text: 'text-red-900', border: 'border-red-200',
  },
};

function ResultView({
  data,
  onReset,
  currentStatus,
  showContactPrompt,
  onSaveContact,
  onDismissContact,
}: {
  data: AnalisisCompleto;
  onReset: () => void;
  currentStatus?: EstadoPedido;
  showContactPrompt?: boolean;
  onSaveContact?: (c: ContactInfo) => void;
  onDismissContact?: () => void;
}) {
  const { extraido, calculo } = data;
  const tier = getTier(extraido.categoria_estimada);
  const isAltoValor = calculo.fee_aplicado === 'preferencial';
  const statusInfo = currentStatus ? RESULT_STATUS_INFO[currentStatus] : null;

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

      {/* Status banner */}
      {statusInfo && (
        <div className={`rounded-xl border ${statusInfo.border} ${statusInfo.bg} px-4 py-3 mb-5 flex items-start gap-3`}>
          <span className="text-xl leading-none mt-0.5">{statusInfo.emoji}</span>
          <div>
            <p className={`text-sm font-semibold ${statusInfo.text}`}>{statusInfo.label}</p>
            <p className={`text-xs mt-0.5 ${statusInfo.text} opacity-80`}>{statusInfo.desc}</p>
            {currentStatus === 'en_pobox' && (
              <p className={`text-sm font-bold mt-1 ${statusInfo.text}`}>
                Comisión a pagar: {formatMXN(calculo.fee_mxn)}
              </p>
            )}
          </div>
        </div>
      )}

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
        <p>Cuando llegue tu paquete a McAllen te avisamos por WhatsApp.</p>
        <p className="mt-1">Pasas a recoger a tu sucursal y pagas en efectivo.</p>
      </div>

      {/* Contact capture — only shown on first visit */}
      {showContactPrompt && onSaveContact && onDismissContact && (
        <ContactCaptureCard onSave={onSaveContact} onDismiss={onDismissContact} />
      )}
    </div>
  );
}

// ── ContactCaptureCard ─────────────────────────────────────────────────────

function ContactCaptureCard({
  onSave,
  onDismiss,
}: {
  onSave: (c: ContactInfo) => void;
  onDismiss: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  return (
    <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
      <p className="text-sm font-semibold text-blue-900 mb-0.5">📲 ¿Te avisamos cuando llegue?</p>
      <p className="text-xs text-blue-700 mb-4">
        Guardamos tu contacto una vez y te notificamos por WhatsApp cuando tu paquete llegue a McAllen.
      </p>
      <div className="space-y-2 mb-4">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Tu nombre"
          className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none"
        />
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="WhatsApp (ej. 8181234567)"
          className="w-full rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm text-neutral-800 placeholder:text-neutral-400 focus:border-blue-400 focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => nombre.trim() && whatsapp.trim() && onSave({ nombre: nombre.trim(), whatsapp: whatsapp.trim() })}
          disabled={!nombre.trim() || !whatsapp.trim()}
          className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40"
        >
          Guardar contacto
        </button>
        <button
          onClick={onDismiss}
          className="rounded-xl border border-blue-200 px-4 py-2.5 text-sm text-blue-600 transition hover:bg-blue-100"
        >
          Ahora no
        </button>
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
  | { found: true; tienda: string; producto: string; precio_usd: number; fee_mxn: number; status: 'pendiente' | 'en_pobox' | 'entregado' | 'rechazado'; timestamp: number };

const STATUS_INFO = {
  pendiente: {
    emoji: '🕐',
    label: 'En proceso',
    desc: 'Tu recibo fue recibido y está siendo procesado. Te avisaremos cuando tu paquete llegue a McAllen.',
    color: 'bg-amber-50 border-amber-200 text-amber-900',
  },
  en_pobox: {
    emoji: '📦',
    label: 'Llegó a McAllen',
    desc: 'Tu paquete llegó al PO Box Voxoy en McAllen, TX. Pasa a recogerlo a tu sucursal de lunes a sábado 9am - 6pm.',
    color: 'bg-blue-50 border-blue-200 text-blue-900',
  },
  entregado: {
    emoji: '✅',
    label: 'Entregado',
    desc: 'Tu paquete fue entregado. Gracias por confiar en Voxoy.',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  },
  rechazado: {
    emoji: '❌',
    label: 'Rechazado',
    desc: 'Tu pedido no pudo ser procesado. Contacta a Voxoy para más información.',
    color: 'bg-red-50 border-red-200 text-red-900',
  },
};

function OrderStatusLookup({
  contact,
  onEditContact,
}: {
  contact: ContactInfo | null;
  onEditContact: (c: ContactInfo) => void;
}) {
  const [orden, setOrden] = useState('');
  const [result, setResult] = useState<PedidoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');

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

  function startEditContact() {
    setEditNombre(contact?.nombre ?? '');
    setEditWhatsapp(contact?.whatsapp ?? '');
    setEditingContact(true);
  }

  return (
    <div className="mt-12 border-t border-neutral-200 pt-8">
      {/* Saved contact indicator */}
      {contact && !editingContact && (
        <div className="mb-6 flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-3">
          <div>
            <p className="text-xs text-neutral-500">Tus avisos van a</p>
            <p className="text-sm font-semibold text-neutral-800">{contact.nombre} · {contact.whatsapp}</p>
          </div>
          <button onClick={startEditContact} className="text-xs text-neutral-500 hover:text-voxoy-red transition">
            ✏️ cambiar
          </button>
        </div>
      )}
      {editingContact && (
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4 space-y-2">
          <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} placeholder="Nombre" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-voxoy-red focus:outline-none" />
          <input value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} placeholder="WhatsApp" className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm focus:border-voxoy-red focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={() => { if (editNombre.trim() && editWhatsapp.trim()) { onEditContact({ nombre: editNombre.trim(), whatsapp: editWhatsapp.trim() }); setEditingContact(false); } }} className="flex-1 rounded-xl bg-voxoy-red py-2 text-sm font-semibold text-white hover:bg-voxoy-red-dark transition">Guardar</button>
            <button onClick={() => setEditingContact(false)} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-50 transition">Cancelar</button>
          </div>
        </div>
      )}
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
                  {(result.status === 'en_pobox' || result.status === 'entregado') && (
                    <p className="text-sm font-semibold mt-2">
                      Comisión a pagar al recoger: {formatMXN(result.fee_mxn)}
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

const HISTORY_STATUS_PILL: Record<EstadoPedido, { label: string; emoji: string; cls: string }> = {
  pendiente: { label: 'En proceso', emoji: '🕐', cls: 'bg-amber-50 text-amber-700' },
  en_pobox: { label: 'En McAllen', emoji: '📦', cls: 'bg-blue-50 text-blue-700' },
  entregado: { label: 'Entregado', emoji: '✅', cls: 'bg-emerald-50 text-emerald-700' },
  rechazado: { label: 'Rechazado', emoji: '❌', cls: 'bg-red-50 text-red-700' },
};

function HistoryPanel({
  history,
  onClear,
  onSelect,
  statusMap,
}: {
  history: AnalisisCompleto[];
  onClear: () => void;
  onSelect: (item: AnalisisCompleto) => void;
  statusMap: Record<string, EstadoPedido>;
}) {
  return (
    <div className="mt-12 border-t border-neutral-200 pt-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">
          Pedidos recientes ({history.length})
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-neutral-500 transition hover:text-voxoy-red"
        >
          Limpiar historial
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {history.map((item) => {
          const status: EstadoPedido = statusMap[item.id] ?? 'pendiente';
          const pill = HISTORY_STATUS_PILL[status];
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="text-left rounded-xl border border-neutral-200 bg-white p-3.5 transition hover:border-voxoy-red hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs text-neutral-500 truncate leading-tight">{item.extraido.tienda}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${pill.cls}`}>
                  {pill.emoji} {pill.label}
                </span>
              </div>
              <p className="text-sm font-semibold text-voxoy-black truncate leading-snug">{item.extraido.producto}</p>
              <p className="text-sm text-voxoy-red font-bold mt-1.5">
                {formatMXN(item.calculo.fee_mxn)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

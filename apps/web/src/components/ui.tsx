import { useCallback, useEffect, useState, type ReactNode } from "react";
import { mensajeError } from "../lib/api";
import { useTema } from "../lib/tema";

// ---------- Íconos de línea ----------
const RUTAS: Record<string, ReactNode> = {
  panel: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  alumnos: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.4" /><path d="M17 14c2.5 0 4 1.8 4 4.5" /></>,
  familias: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v10h13V10" /><path d="M10 20v-5h4v5" /></>,
  cobranza: <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10.5h18" /><path d="M7 15.5h4" /></>,
  comprobantes: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="m9 15 2 2 4-4" /></>,
  cargos: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" /></>,
  gastos: <><path d="M4 4h16v16l-3-2-2.5 2-2.5-2-2.5 2L7 18l-3 2z" /><path d="M8 9h8M8 13h5" /></>,
  contabilidad: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M5 17a3 3 0 0 1 3-3h11" /></>,
  ajustes: <><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" /></>,
  salir: <><path d="M10 4H5v16h5" /><path d="M15 8l4 4-4 4M19 12H9" /></>,
  ojo: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  ojoNo: <><path d="M3 3l18 18" /><path d="M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  subir: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></>,
  sol: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" /></>,
  luna: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  ok: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  eventos: <><path d="M5 21V4" /><path d="M5 4h12l-2.5 4L17 12H5" /></>,
  cerrar: <path d="M6 6l12 12M18 6 6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>,
  imprimir: <><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></>,
  alerta: <><path d="M12 4 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.1" /></>,
  archivo: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></>,
  arqueo: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h3.5" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  copiar: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>,
  banco: <><path d="M3 9.5 12 4l9 5.5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
};

export function Icon({ name, size = 18, className = "" }: { name: keyof typeof RUTAS | string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      {RUTAS[name]}
    </svg>
  );
}

// ---------- Marca ----------
/** Escudo del colegio. El JPG tiene fondo blanco: `mix-blend-multiply` lo hace desaparecer sobre fondos claros. */
export function Escudo({ className = "h-10" }: { className?: string }) {
  return <img src="/logo.jpg" alt="Escudo del Instituto La Sma. Trinidad" className={`escudo w-auto select-none mix-blend-multiply ${className}`} draggable={false} />;
}

/** Marca compacta (escudo + nombre) para encabezados y menú. */
export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <Escudo className="h-11" />
      <div className="leading-tight">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-peligro">Instituto</p>
        <p className="text-[15px] font-semibold text-marca">La Sma. Trinidad</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-tenue">Hernando</p>
      </div>
    </div>
  );
}

// ---------- Formularios ----------
export function Campo({ label, children, ayuda, className = "" }: { label: string; children: ReactNode; ayuda?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-tenue">{ayuda}</span>}
    </label>
  );
}

export function ErrorBox({ error }: { error: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-peligro/25 bg-peligro-claro px-3.5 py-2.5 text-sm text-peligro">
      <Icon name="alerta" size={16} className="mt-0.5" />
      <span>{error}</span>
    </p>
  );
}

export function Chip({ clase, children }: { clase: string; children: ReactNode }) {
  return <span className={`chip ${clase}`}>{children}</span>;
}

// ---------- Estructura ----------
export function Modal({ titulo, onClose, children, ancho = "max-w-lg" }: { titulo: string; onClose: () => void; children: ReactNode; ancho?: string }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", f); document.body.style.overflow = previo; };
  }, [onClose]);
  return (
    <div className="no-imprimir fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`card flex max-h-[92vh] w-full ${ancho} flex-col rounded-b-none shadow-flota sm:rounded-b-2xl`}>
        <header className="flex items-center justify-between border-b border-borde px-5 py-4">
          <h2 className="text-base">{titulo}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-tenue hover:bg-fondo hover:text-tinta" aria-label="Cerrar"><Icon name="cerrar" /></button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Cabecera({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <span className="franja mb-3 block h-1 w-14 rounded-full" aria-hidden />
        <h1 className="text-2xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-suave">{subtitulo}</p>}
      </div>
      {children && <div className="no-imprimir flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Vacio({ texto, icono = "archivo" }: { texto: string; icono?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-tenue">
      <Icon name={icono} size={28} className="text-borde" />
      <p>{texto}</p>
    </div>
  );
}

export function Cargando() {
  return <p className="px-6 py-12 text-center text-sm text-tenue">Cargando…</p>;
}

const ACENTOS = {
  marca: { chip: "bg-marca-claro text-marca", borde: "border-t-marca" },
  celeste: { chip: "bg-celeste/15 text-celeste", borde: "border-t-celeste" },
  ok: { chip: "bg-ok-claro text-ok", borde: "border-t-ok" },
  oro: { chip: "bg-oro-claro text-aviso", borde: "border-t-oro" },
  peligro: { chip: "bg-peligro-claro text-peligro", borde: "border-t-peligro" },
} as const;
export type Acento = keyof typeof ACENTOS;

export function Kpi({ titulo, valor, nota, tono = "normal", acento = "marca", icono }: { titulo: string; valor: string; nota?: string; tono?: "normal" | "bien" | "mal" | "aviso"; acento?: Acento; icono?: string }) {
  const color = { normal: "text-tinta", bien: "text-ok", mal: "text-peligro", aviso: "text-aviso" }[tono];
  const a = ACENTOS[acento];
  return (
    <div className={`card border-t-4 p-5 ${a.borde}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-tenue">{titulo}</p>
        {icono && <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.chip}`}><Icon name={icono} size={18} /></span>}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}>{valor}</p>
      {nota && <p className="mt-1 text-xs text-tenue">{nota}</p>}
    </div>
  );
}

/** Botón de modo claro/oscuro. */
export function CambiarTema({ className = "" }: { className?: string }) {
  const { tema, alternar } = useTema();
  const oscuro = tema === "oscuro";
  return (
    <button type="button" onClick={alternar} aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} title={oscuro ? "Modo claro" : "Modo oscuro"}
      className={`no-imprimir rounded-xl p-2 text-suave transition hover:bg-marca-claro hover:text-marca ${className}`}>
      <Icon name={oscuro ? "sol" : "luna"} size={18} />
    </button>
  );
}

// ---------- Carga de datos ----------
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargar = useCallback(() => {
    setCargando(true);
    return fn().then((d) => { setData(d); setError(""); }).catch((e) => setError(mensajeError(e))).finally(() => setCargando(false));
  }, deps);
  useEffect(() => { void cargar(); }, [cargar]);
  return { data, error, cargando, recargar: cargar, setData };
}

export function Pestanas<T extends string>({ valor, onChange, opciones }: { valor: T; onChange: (v: T) => void; opciones: { id: T; texto: string }[] }) {
  return (
    <div className="no-imprimir mb-5 flex gap-1 overflow-x-auto rounded-xl bg-borde/50 p-1" role="tablist">
      {opciones.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={valor === o.id} onClick={() => onChange(o.id)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${valor === o.id ? "bg-marca text-white shadow-suave" : "text-suave hover:text-tinta"}`}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}

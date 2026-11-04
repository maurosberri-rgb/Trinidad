import { useMemo, useRef, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import { api, mensajeError } from "../../lib/api";
import { ESTADO_CARGO, fecha, hoyISO, MESES, pesos, sumar } from "../../lib/format";
import { Campo, Chip, ErrorBox, Icon, Modal, Vacio } from "../../components/ui";
import type { CargoF, CtxFamilia } from "./PortalLayout";

const mesDe = (p: string) => { const [a, m] = p.split("-"); return `${MESES[Number(m) - 1]} ${a}`; };

export default function Inicio() {
  const { datos, recargar } = useOutletContext<CtxFamilia>();
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [informando, setInformando] = useState(false);
  const [exito, setExito] = useState(false);

  const pendientes = datos.cargos.filter((c) => c.pendiente > 0);
  const vencidas = pendientes.filter((c) => c.estado === "vencido");
  const totalDeuda = sumar(pendientes.map((c) => c.pendiente));
  const totalVencido = sumar(vencidas.map((c) => c.pendiente));
  const proxima = pendientes.filter((c) => c.estado !== "vencido")[0];
  const seleccionadas = pendientes.filter((c) => elegidas.has(c.id));
  const totalElegido = sumar(seleccionadas.map((c) => c.pendiente));
  const rechazados = datos.comprobantes.filter((c) => c.estado === "rechazado").slice(0, 2);

  const porAlumno = useMemo(() => {
    const m = new Map<string, { nombre: string; lista: CargoF[] }>();
    for (const c of pendientes) {
      if (!m.has(c.alumnoId)) m.set(c.alumnoId, { nombre: c.alumno, lista: [] });
      m.get(c.alumnoId)!.lista.push(c);
    }
    return [...m.values()];
  }, [pendientes]);

  const alternar = (c: CargoF) => setElegidas((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; });
  const seleccionarVencidas = () => setElegidas(new Set(vencidas.filter((c) => !c.enRevision).map((c) => c.id)));
  const seleccionarTodas = () => setElegidas(new Set(pendientes.filter((c) => !c.enRevision).map((c) => c.id)));

  return (
    <div className="pb-28">
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b3a9e] via-marca to-[#0a2a6e] p-6 text-white shadow-flota sm:p-8">
        <span className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-celeste/30" aria-hidden />
        <span className="absolute -bottom-14 right-24 h-32 w-32 rounded-full bg-oro/30" aria-hidden />
        <span className="absolute right-6 top-6 h-5 w-5 rounded-full bg-peligro/70" aria-hidden />
        <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-oro">Portal de familias</p>
        <h1 className="relative mt-2 text-2xl sm:text-3xl">Hola, {datos.responsable.nombre}</h1>
        <p className="relative mt-1 text-sm text-white/80">
          {datos.alumnos.length ? datos.alumnos.map((a) => `${a.nombre.split(", ")[1]} (${a.curso || a.nivel})`).join(" · ") : "Resumen de tu cuenta"}
        </p>
      </div>

      {exito && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-ok/25 bg-ok-claro p-4 text-sm text-ok" role="status">
          <Icon name="ok" className="mt-0.5" />
          <p>¡Recibimos tu comprobante! La administración lo revisa y, al confirmarlo, tus cuotas pasan a «Pagada». Podés ver el estado en el Historial.</p>
        </div>
      )}
      {rechazados.map((r) => (
        <div key={r.id} className="mb-3 flex items-start gap-3 rounded-2xl border border-peligro/25 bg-peligro-claro p-4 text-sm text-peligro" role="alert">
          <Icon name="alerta" className="mt-0.5" />
          <p><strong className="font-semibold">No pudimos validar tu comprobante del {fecha(r.fechaPago)} ({pesos(r.importe)}).</strong> {r.motivo} Podés volver a informarlo.</p>
        </div>
      ))}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card border-t-4 border-t-celeste p-5">
          <p className="text-xs font-medium text-tenue">Total a pagar</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{pesos(totalDeuda)}</p>
          <p className="mt-1 text-xs text-tenue">{pendientes.length} {pendientes.length === 1 ? "cuota pendiente" : "cuotas pendientes"}</p>
        </div>
        <div className={`card border-t-4 p-5 ${totalVencido > 0 ? "border-t-peligro" : "border-t-ok"}`}>
          <p className="text-xs font-medium text-tenue">Vencido</p>
          <p className={`mt-2 text-2xl font-semibold tabular-nums ${totalVencido > 0 ? "text-peligro" : "text-ok"}`}>{pesos(totalVencido)}</p>
          <p className="mt-1 text-xs text-tenue">{vencidas.length ? `${vencidas.length} con vencimiento pasado` : "Estás al día"}</p>
        </div>
        <div className="card border-t-4 border-t-oro p-5">
          <p className="text-xs font-medium text-tenue">Próximo vencimiento</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{proxima ? fecha(proxima.vencimiento) : "—"}</p>
          <p className="mt-1 truncate text-xs text-tenue">{proxima ? `${proxima.descripcion} · ${pesos(proxima.pendiente)}` : "Sin cuotas por vencer"}</p>
        </div>
      </section>

      {datos.responsable.saldoAFavor > 0 && (
        <p className="mt-3 rounded-xl bg-oro-claro px-4 py-2.5 text-sm text-aviso">Tenés un saldo a favor de <strong>{pesos(datos.responsable.saldoAFavor)}</strong>. La administración lo aplicará a tus próximas cuotas.</p>
      )}

      <div className="mb-3 mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">Cuotas pendientes</h2>
        {pendientes.length > 0 && (
          <div className="flex gap-1 text-sm">
            {vencidas.length > 0 && <button className="btn-ghost btn-sm" onClick={seleccionarVencidas}>Elegir vencidas</button>}
            <button className="btn-ghost btn-sm" onClick={seleccionarTodas}>Elegir todas</button>
            {elegidas.size > 0 && <button className="btn-ghost btn-sm" onClick={() => setElegidas(new Set())}>Limpiar</button>}
          </div>
        )}
      </div>

      {pendientes.length === 0 ? (
        <div className="card"><Vacio icono="ok" texto="No tenés cuotas pendientes. ¡Gracias!" /></div>
      ) : (
        <div className="space-y-4">
          {porAlumno.map((g) => (
            <div key={g.nombre} className="card overflow-hidden">
              <p className="border-b border-borde bg-fondo/60 px-5 py-3 text-sm font-semibold">{g.nombre}</p>
              <ul>
                {g.lista.map((c) => {
                  const est = ESTADO_CARGO[c.estado];
                  const marcado = elegidas.has(c.id);
                  return (
                    <li key={c.id} className="border-b border-borde/70 last:border-0">
                      <label className={`flex items-center gap-4 px-5 py-4 ${c.enRevision ? "opacity-60" : "cursor-pointer hover:bg-fondo/50"}`}>
                        <input type="checkbox" className="h-5 w-5 shrink-0 accent-marca" checked={marcado} disabled={c.enRevision} onChange={() => alternar(c)} aria-label={`Elegir ${c.descripcion}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{c.descripcion}</span>
                          <span className="mt-0.5 block text-xs text-tenue">Vence el {fecha(c.vencimiento)}{c.descuento > 0 && ` · incluye beca de ${pesos(c.descuento)}`}</span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-semibold tabular-nums">{pesos(c.pendiente)}</span>
                          {c.enRevision ? <Chip clase="bg-aviso-claro text-aviso">Comprobante en revisión</Chip> : <Chip clase={est.clase}>{est.texto}</Chip>}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {seleccionadas.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-sup/95 px-4 py-3 shadow-flota backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div>
              <p className="text-xs text-tenue">{seleccionadas.length} {seleccionadas.length === 1 ? "cuota elegida" : "cuotas elegidas"}</p>
              <p className="text-lg font-semibold tabular-nums">{pesos(totalElegido)}</p>
            </div>
            <button className="btn-primary" onClick={() => setInformando(true)}><Icon name="subir" />Informar pago</button>
          </div>
        </div>
      )}

      {informando && (
        <InformarPago cargos={seleccionadas} total={totalElegido} banco={datos.banco} onClose={() => setInformando(false)}
          onListo={async () => { setInformando(false); setElegidas(new Set()); setExito(true); await recargar(); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
      )}
    </div>
  );
}

/** Reduce las fotos del celular (lado mayor 1600 px, JPEG) para que el envío sea liviano. */
async function prepararArchivo(f: File): Promise<{ nombre: string; tipo: string; base64: string }> {
  const aBase64 = (blob: Blob) => new Promise<string>((ok, mal) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] ?? ""); r.onerror = () => mal(new Error("No se pudo leer el archivo")); r.readAsDataURL(blob); });
  if (f.type === "application/pdf") return { nombre: f.name, tipo: f.type, base64: await aBase64(f) };
  if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) throw new Error("Subí una imagen (JPG, PNG, WEBP) o un PDF");
  try {
    const bmp = await createImageBitmap(f);
    const esc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(bmp.width * esc); lienzo.height = Math.round(bmp.height * esc);
    lienzo.getContext("2d")!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
    if (blob) return { nombre: f.name.replace(/\.\w+$/, "") + ".jpg", tipo: "image/jpeg", base64: await aBase64(blob) };
  } catch { /* si no se puede reducir, se envía tal cual */ }
  return { nombre: f.name, tipo: f.type, base64: await aBase64(f) };
}

function InformarPago({ cargos, total, banco, onClose, onListo }: { cargos: CargoF[]; total: number; banco: CtxFamilia["datos"]["banco"]; onClose: () => void; onListo: () => void }) {
  const [importe, setImporte] = useState(String(total));
  const [fechaPago, setFechaPago] = useState(hoyISO());
  const [nota, setNota] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const copiar = (k: string, v: string) => { void navigator.clipboard?.writeText(v); setCopiado(k); setTimeout(() => setCopiado(""), 1500); };

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!archivo) { setError("Adjuntá el comprobante de la transferencia"); return; }
    setEnviando(true);
    try {
      const a = await prepararArchivo(archivo);
      await api("/familia/comprobantes", { cuerpo: { cargoIds: cargos.map((c) => c.id), importe: Number(importe), fechaPago, nota, archivo: a } });
      onListo();
    } catch (err) { setError(mensajeError(err)); } finally { setEnviando(false); }
  }

  const filas: [string, string, string][] = [["alias", "Alias", banco.alias], ["cbu", "CBU / CVU", banco.cbu], ["titular", "Titular", banco.titular], ["banco", "Banco", banco.banco], ["cuit", "CUIT", banco.cuit]];
  const datosOk = banco.alias || banco.cbu;

  return (
    <Modal titulo="Informar pago por transferencia" onClose={onClose} ancho="max-w-xl">
      <ol className="space-y-5">
        <li>
          <p className="mb-2 text-sm font-semibold">1. Transferí a esta cuenta</p>
          {datosOk ? (
            <dl className="rounded-xl border border-borde bg-fondo/60 p-1">
              {filas.filter(([, , v]) => v).map(([k, etiqueta, valor]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <dt className="text-tenue">{etiqueta}</dt>
                  <dd className="flex items-center gap-2 font-medium">
                    <span className="break-all text-right">{valor}</span>
                    {(k === "alias" || k === "cbu") && (
                      <button type="button" onClick={() => copiar(k, valor)} className="rounded-lg p-1.5 text-tenue hover:bg-sup hover:text-marca" aria-label={`Copiar ${etiqueta}`}>
                        {copiado === k ? <Icon name="ok" size={16} className="text-ok" /> : <Icon name="copiar" size={16} />}
                      </button>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="rounded-xl bg-aviso-claro px-4 py-3 text-sm text-aviso">El colegio todavía no cargó sus datos bancarios. Consultá en la administración.</p>
          )}
        </li>
        <li>
          <p className="mb-2 text-sm font-semibold">2. Contanos qué pagaste</p>
          <ul className="mb-3 rounded-xl border border-borde text-sm">
            {cargos.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 border-b border-borde/70 px-3 py-2 last:border-0">
                <span className="truncate">{c.alumno.split(", ")[1]} · {c.descripcion}</span>
                <span className="tabular-nums">{pesos(c.pendiente)}</span>
              </li>
            ))}
            <li className="flex justify-between bg-fondo/60 px-3 py-2 font-semibold"><span>Total de las cuotas</span><span className="tabular-nums">{pesos(total)}</span></li>
          </ul>
          <form onSubmit={enviar} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Importe transferido"><input className="input" type="number" min="1" step="0.01" required value={importe} onChange={(e) => setImporte(e.target.value)} /></Campo>
              <Campo label="Fecha de la transferencia"><input className="input" type="date" required max={hoyISO()} value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} /></Campo>
            </div>
            <Campo label="Comprobante (imagen o PDF)">
              <button type="button" onClick={() => input.current?.click()}
                className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-4 text-left text-sm transition hover:border-marca hover:bg-marca-claro/50 ${archivo ? "border-ok bg-ok-claro/50" : "border-borde"}`}>
                <Icon name={archivo ? "ok" : "subir"} className={archivo ? "text-ok" : "text-tenue"} />
                <span className="min-w-0 flex-1 truncate">{archivo ? archivo.name : "Tocá para elegir el archivo o sacar una foto"}</span>
              </button>
              <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
            </Campo>
            <Campo label="Comentario (opcional)"><input className="input" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: transferí desde la cuenta de mi pareja" /></Campo>
            <ErrorBox error={error} />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn-primary" disabled={enviando}>{enviando ? "Enviando…" : "Enviar comprobante"}</button>
            </div>
          </form>
        </li>
      </ol>
    </Modal>
  );
}

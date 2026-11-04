import { useMemo, useState } from "react";
import { api } from "../../lib/api";
import { MEDIOS, fecha, hoyISO, nombreMedio, pesos, sumar } from "../../lib/format";
import type { PagoAdm } from "../../components/RegistrarPago";
import { Campo, Cargando, Chip, ErrorBox, Icon, Kpi, Vacio, useCarga } from "../../components/ui";

const ORIGEN = {
  presencial: { texto: "Presencial", clase: "bg-celeste/15 text-celeste" },
  portal: { texto: "Portal web", clase: "bg-oro-claro text-aviso" },
} as const;

/** Arqueo de caja: todos los cobros del período, separados por medio de pago y por origen (ventanilla o portal de familias). */
export default function Arqueo() {
  const { data, error } = useCarga(() => api<PagoAdm[]>("/admin/pagos"));
  const [desde, setDesde] = useState(hoyISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [origen, setOrigen] = useState<"todos" | "presencial" | "portal">("todos");
  const [contado, setContado] = useState("");

  const cobros = useMemo(
    () => (data ?? []).filter((p) => !p.anulado && p.origen !== "saldo" && p.fecha >= desde && p.fecha <= hasta && (origen === "todos" || p.origen === origen)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero)),
    [data, desde, hasta, origen],
  );
  const anulados = (data ?? []).filter((p) => p.anulado && p.origen !== "saldo" && p.fecha >= desde && p.fecha <= hasta).length;

  const total = sumar(cobros.map((p) => p.importe));
  const totalPresencial = sumar(cobros.filter((p) => p.origen === "presencial").map((p) => p.importe));
  const totalPortal = sumar(cobros.filter((p) => p.origen === "portal").map((p) => p.importe));
  const porMedio = Object.keys(MEDIOS).map((m) => ({
    medio: m,
    presencial: sumar(cobros.filter((p) => p.medio === m && p.origen === "presencial").map((p) => p.importe)),
    portal: sumar(cobros.filter((p) => p.medio === m && p.origen === "portal").map((p) => p.importe)),
    cantidad: cobros.filter((p) => p.medio === m).length,
  })).filter((f) => f.cantidad > 0);
  const efectivo = sumar(cobros.filter((p) => p.medio === "efectivo").map((p) => p.importe));
  const diferencia = contado === "" ? null : Number(contado) - efectivo;

  return (
    <>
      <div className="card no-imprimir mb-5 flex flex-wrap items-end gap-3 p-4">
        <Campo label="Desde"><input className="input" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} /></Campo>
        <Campo label="Hasta"><input className="input" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} /></Campo>
        <Campo label="Origen">
          <select className="input" value={origen} onChange={(e) => setOrigen(e.target.value as typeof origen)}>
            <option value="todos">Todos los cobros</option><option value="presencial">Solo presenciales</option><option value="portal">Solo del portal web</option>
          </select>
        </Campo>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => { setDesde(hoyISO()); setHasta(hoyISO()); }}>Hoy</button>
          <button className="btn-ghost btn-sm" onClick={() => { const h = hoyISO(); setDesde(`${h.slice(0, 7)}-01`); setHasta(h); }}>Este mes</button>
        </div>
        <button className="btn-sec ml-auto" onClick={() => window.print()}><Icon name="imprimir" size={16} />Imprimir</button>
      </div>
      <ErrorBox error={error} />
      {!data ? <Cargando /> : (
        <>
          <h2 className="mb-1 hidden text-lg print:block">Arqueo de caja · {fecha(desde)} al {fecha(hasta)}</h2>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Kpi acento="marca" icono="cobranza" titulo="Total cobrado" valor={pesos(total)} nota={`${cobros.length} ${cobros.length === 1 ? "cobro" : "cobros"}`} />
            <Kpi acento="celeste" icono="cobranza" titulo="Presencial" valor={pesos(totalPresencial)} nota={`${cobros.filter((p) => p.origen === "presencial").length} cobros en ventanilla`} />
            <Kpi acento="oro" icono="comprobantes" titulo="Portal web" valor={pesos(totalPortal)} nota={`${cobros.filter((p) => p.origen === "portal").length} transferencias informadas`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="card">
              <h2 className="border-b border-borde px-5 py-4 text-base">Resumen por medio de pago</h2>
              {porMedio.length === 0 ? <Vacio icono="cobranza" texto="No hay cobros en el período." /> : (
                <div className="overflow-x-auto">
                  <table className="tabla">
                    <thead><tr><th>Medio</th><th className="num">Cant.</th><th className="num">Presencial</th><th className="num">Portal</th><th className="num">Total</th></tr></thead>
                    <tbody>
                      {porMedio.map((f) => (
                        <tr key={f.medio}><td className="font-medium">{nombreMedio(f.medio)}</td><td className="num">{f.cantidad}</td><td className="num">{f.presencial ? pesos(f.presencial) : "—"}</td><td className="num">{f.portal ? pesos(f.portal) : "—"}</td><td className="num font-semibold">{pesos(f.presencial + f.portal)}</td></tr>
                      ))}
                      <tr className="bg-fondo/60 font-semibold"><td>Total</td><td className="num">{cobros.length}</td><td className="num">{pesos(totalPresencial)}</td><td className="num">{pesos(totalPortal)}</td><td className="num">{pesos(total)}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card h-fit p-5">
              <h2 className="text-base">Control del efectivo</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-suave">Efectivo según el sistema</dt><dd className="font-semibold tabular-nums">{pesos(efectivo)}</dd></div>
              </dl>
              <div className="no-imprimir mt-3"><Campo label="Efectivo contado en caja"><input className="input" type="number" min="0" step="0.01" value={contado} onChange={(e) => setContado(e.target.value)} placeholder="0,00" /></Campo></div>
              {contado !== "" && <p className="hidden text-sm print:block">Efectivo contado: <strong>{pesos(Number(contado))}</strong></p>}
              {diferencia !== null && (
                <p className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${Math.abs(diferencia) < 0.005 ? "bg-ok-claro text-ok" : "bg-peligro-claro text-peligro"}`} role="status">
                  {Math.abs(diferencia) < 0.005 ? "La caja cierra: no hay diferencia." : diferencia > 0 ? `Sobrante de ${pesos(diferencia)}.` : `Faltante de ${pesos(-diferencia)}.`}
                </p>
              )}
              <p className="mt-3 text-xs text-tenue">Cheques y tarjetas no son efectivo: figuran en el resumen y quedan como valores a depositar hasta acreditarse.{anulados > 0 && ` Hay ${anulados} recibos anulados en el período que no se suman.`}</p>
            </section>
          </div>

          <section className="card mt-6">
            <h2 className="border-b border-borde px-5 py-4 text-base">Detalle de cobros</h2>
            {cobros.length === 0 ? <Vacio icono="cobranza" texto="No hay cobros para mostrar." /> : (
              <div className="overflow-x-auto">
                <table className="tabla">
                  <thead><tr><th>Fecha</th><th>Recibo</th><th>Familia</th><th>Medio</th><th>Origen</th><th>Aplicado a</th><th className="num">Importe</th></tr></thead>
                  <tbody>
                    {cobros.map((p) => (
                      <tr key={p.id} className="align-top">
                        <td className="whitespace-nowrap">{fecha(p.fecha)}</td>
                        <td className="font-medium">{p.numero}</td>
                        <td>{p.responsable}</td>
                        <td>{nombreMedio(p.medio)}{p.referencia ? <span className="block text-xs text-tenue">{p.referencia}</span> : null}</td>
                        <td><Chip clase={ORIGEN[p.origen as "presencial" | "portal"]?.clase ?? ""}>{ORIGEN[p.origen as "presencial" | "portal"]?.texto}</Chip></td>
                        <td className="max-w-xs text-suave">{p.detalle.map((d) => d.descripcion).join(", ") || "Saldo a favor"}</td>
                        <td className="num font-medium">{pesos(p.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}

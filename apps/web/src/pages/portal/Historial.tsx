import { useOutletContext } from "react-router-dom";
import { fecha, pesos } from "../../lib/format";
import { Chip, Vacio } from "../../components/ui";
import type { CtxFamilia } from "./PortalLayout";

const ESTADO = {
  pendiente: { t: "En revisión", c: "bg-aviso-claro text-aviso" },
  aprobado: { t: "Aprobado", c: "bg-ok-claro text-ok" },
  rechazado: { t: "Rechazado", c: "bg-peligro-claro text-peligro" },
} as const;

import { nombreMedio } from "../../lib/format";

export default function Historial() {
  const { datos } = useOutletContext<CtxFamilia>();
  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-1 text-2xl">Historial</h1>
        <p className="mb-4 text-sm text-suave">Los comprobantes que informaste y los pagos que registró el colegio.</p>
        <h2 className="mb-3 text-lg">Comprobantes enviados</h2>
        <div className="card">
          {datos.comprobantes.length === 0 ? <Vacio texto="Todavía no informaste ningún pago." icono="comprobantes" /> : (
            <ul>
              {datos.comprobantes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 border-b border-borde/70 px-5 py-4 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Transferencia del {fecha(c.fechaPago)}</p>
                    <p className="mt-0.5 text-xs text-tenue">{c.cargos.map((x) => x.descripcion).join(" · ")}</p>
                    {c.estado === "rechazado" && <p className="mt-1 text-xs text-peligro">{c.motivo}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{pesos(c.importe)}</p>
                    <Chip clase={ESTADO[c.estado].c}>{ESTADO[c.estado].t}</Chip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg">Pagos registrados</h2>
        <div className="card">
          {datos.pagos.length === 0 ? <Vacio texto="Aún no hay pagos registrados." icono="cobranza" /> : (
            <ul>
              {datos.pagos.map((p) => (
                <li key={p.id} className="border-b border-borde/70 px-5 py-4 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Recibo {p.numero} <span className="font-normal text-tenue">· {fecha(p.fecha)} · {nombreMedio(p.medio)}</span></p>
                    <p className="text-sm font-semibold tabular-nums">{pesos(p.importe)}</p>
                  </div>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-tenue">
                    {p.detalle.map((d, i) => <li key={i}>{d.alumno.split(", ")[1]} · {d.descripcion} — {pesos(d.monto)}</li>)}
                    {p.aFavor > 0 && <li>Saldo a favor generado — {pesos(p.aFavor)}</li>}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

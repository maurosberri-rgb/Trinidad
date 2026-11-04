import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { MESES_CORTOS, pesos } from "../../lib/format";
import { Cabecera, Cargando, ErrorBox, Icon, Kpi, Vacio, useCarga } from "../../components/ui";

interface Resumen {
  alumnos: number; familias: number; porCobrar: number; vencido: number; comprobantesPendientes: number; cobradoMes: number;
  resultadoAnio: number; ingresosAnio: number; egresosAnio: number; ciclo: number;
  morosos: { id: string; familia: string; monto: number }[];
  meses: { mes: number; ingresos: number; egresos: number; cobrado: number }[];
}

export default function Panel() {
  const { data, error } = useCarga(() => api<Resumen>("/admin/resumen"));
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Cargando />;
  const maximo = Math.max(1, ...data.meses.flatMap((m) => [m.ingresos, m.egresos, m.cobrado]));

  return (
    <>
      <Cabecera titulo="Panel" subtitulo={`Ciclo lectivo ${data.ciclo} · ${data.alumnos} alumnos en ${data.familias} familias`} />

      {data.comprobantesPendientes > 0 && (
        <Link to="/admin/comprobantes" className="mb-5 flex items-center gap-3 rounded-2xl border border-oro/30 bg-oro-claro px-5 py-4 text-sm text-aviso transition hover:shadow-suave">
          <Icon name="comprobantes" />
          <span className="flex-1"><strong className="font-semibold">{data.comprobantesPendientes} {data.comprobantesPendientes === 1 ? "comprobante espera" : "comprobantes esperan"} revisión.</strong> Aprobalos para aplicar los pagos a las cuotas.</span>
          <Icon name="flecha" />
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Total por cobrar" valor={pesos(data.porCobrar)} nota="Cuotas y actividades pendientes" />
        <Kpi titulo="Deuda vencida" valor={pesos(data.vencido)} tono={data.vencido > 0 ? "mal" : "bien"} nota="Con fecha de vencimiento pasada" />
        <Kpi titulo="Cobrado este mes" valor={pesos(data.cobradoMes)} tono="bien" />
        <Kpi titulo={`Resultado ${data.ciclo}`} valor={pesos(data.resultadoAnio)} tono={data.resultadoAnio >= 0 ? "bien" : "mal"} nota={`Ingresos ${pesos(data.ingresosAnio)} − egresos ${pesos(data.egresosAnio)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base">Año {data.ciclo} por mes</h2>
            <div className="flex gap-4 text-xs text-suave">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-marca" />Ingresos</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-oro" />Egresos</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-ok" />Cobrado</span>
            </div>
          </div>
          <div className="flex h-56 items-end gap-2 sm:gap-3" role="img" aria-label="Ingresos, egresos y cobranzas por mes">
            {data.meses.map((m) => (
              <div key={m.mes} className="flex h-full flex-1 flex-col justify-end gap-1">
                <div className="flex flex-1 items-end justify-center gap-[3px]">
                  {([["bg-marca", m.ingresos, "Ingresos"], ["bg-oro", m.egresos, "Egresos"], ["bg-ok", m.cobrado, "Cobrado"]] as const).map(([c, v, t]) => (
                    <div key={t} title={`${t}: ${pesos(v)}`} className={`w-full max-w-[14px] rounded-t ${c}`} style={{ height: `${Math.max(v > 0 ? 3 : 0, (v / maximo) * 100)}%` }} />
                  ))}
                </div>
                <span className="text-center text-[11px] text-tenue">{MESES_CORTOS[m.mes - 1]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="border-b border-borde px-5 py-4 text-base">Mayor deuda vencida</h2>
          {data.morosos.length === 0 ? <Vacio icono="ok" texto="No hay familias con deuda vencida." /> : (
            <ul>
              {data.morosos.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 border-b border-borde/70 px-5 py-3 text-sm last:border-0">
                  <span className="truncate">{m.familia}</span>
                  <span className="font-semibold tabular-nums text-peligro">{pesos(m.monto)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-borde px-5 py-3"><Link to="/admin/cobranza" className="text-sm font-medium text-marca hover:underline">Ir a cobranza →</Link></div>
        </section>
      </div>
    </>
  );
}

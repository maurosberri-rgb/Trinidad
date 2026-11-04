const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const pesos = (n: number) => moneda.format(n || 0);
export const pesosFijos = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);

/** "2026-03-10" → "10/03/2026" (sin pasar por Date para evitar corrimientos de zona horaria). */
export const fecha = (iso: string) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");
export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const dni = (v: string) => v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export const sumar = (l: number[]) => Math.round(l.reduce((s, x) => s + x, 0) * 100) / 100;

/** Medios de pago aceptados en ventanilla; «ayuda» es lo que se pide anotar como referencia. */
export const MEDIOS: Record<string, { texto: string; ayuda: string }> = {
  efectivo: { texto: "Efectivo", ayuda: "" },
  transferencia: { texto: "Transferencia", ayuda: "N° de operación" },
  cheque: { texto: "Cheque", ayuda: "N° de cheque y banco" },
  tarjeta_debito: { texto: "Tarjeta de débito", ayuda: "N° de cupón o lote" },
  tarjeta_credito: { texto: "Tarjeta de crédito", ayuda: "N° de cupón y cuotas" },
  deposito: { texto: "Depósito bancario", ayuda: "N° de boleta" },
  mercadopago: { texto: "Mercado Pago / QR", ayuda: "N° de operación" },
  otro: { texto: "Otro", ayuda: "Referencia" },
};
export const nombreMedio = (m: string) => MEDIOS[m]?.texto ?? m;

export const ESTADO_CARGO: Record<string, { texto: string; clase: string }> = {
  pendiente: { texto: "Pendiente", clase: "bg-marca-claro text-marca" },
  parcial: { texto: "Pago parcial", clase: "bg-aviso-claro text-aviso" },
  vencido: { texto: "Vencida", clase: "bg-peligro-claro text-peligro" },
  pagado: { texto: "Pagada", clase: "bg-ok-claro text-ok" },
  anulado: { texto: "Anulada", clase: "bg-fondo text-tenue" },
};

// Funcions pures: es poden fer servir al servidor i al client.

export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const LOCALE = { ca: "ca-ES", es: "es-ES" } as const;

// Les dates de la base de dades són 'AAAA-MM-DD' sense hora: les llegim com a
// data local perquè no canviïn de dia per la zona horària.
export function dataCurta(iso: string, idioma: "ca" | "es"): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE[idioma], { day: "numeric", month: "short" }).format(
    new Date(a, m - 1, d),
  );
}

export function dataLlarga(iso: string, idioma: "ca" | "es"): string {
  const [a, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE[idioma], {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(a, m - 1, d));
}

export function momentCurt(iso: string, idioma: "ca" | "es"): string {
  return new Intl.DateTimeFormat(LOCALE[idioma], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(iso));
}

// Avui a Barcelona, en format AAAA-MM-DD.
export function avui(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

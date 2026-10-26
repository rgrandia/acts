// Model del plànol. És el mateix format que l'antic seating.html (v:1), de
// manera que els .json desats amb aquella eina es poden importar tal qual.
// Excepció: les arribades (`in`) no es desen aquí sinó a la taula `arribades`.

export type TipusElement = "rows" | "round" | "rect" | "head" | "shape";

export type Seient = {
  i: number;
  label: string;
  tag: string | null; // zona
  blocked: boolean;
  person: string | null;
};

export type ParamsFiles = {
  rows: number;
  cols: number;
  gapX: number;
  gapY: number;
  aisles: string;
  curve: number;
  rowKind: "alpha" | "num";
  numbering: "ltr" | "center";
};
export type ParamsRodona = { n: number; r: number };
export type ParamsRect = { w: number; h: number; top: number; bottom: number; left: number; right: number };
export type ParamsPresidencia = { n: number; pitch: number };
export type ParamsForma = { w: number; h: number; kind: "escenari" | "objecte" };

type Base = { id: string; x: number; y: number; rot: number; name: string; code: string; seats: Seient[] };
export type Element =
  | (Base & { type: "rows"; p: ParamsFiles })
  | (Base & { type: "round"; p: ParamsRodona })
  | (Base & { type: "rect"; p: ParamsRect })
  | (Base & { type: "head"; p: ParamsPresidencia })
  | (Base & { type: "shape"; p: ParamsForma });

export type Zona = { id: string; name: string; color: string };

export type Persona = {
  id: string;
  name: string;
  role: string;
  org: string;
  group: string;
  rank: number;
  seat: { el: string; i: number } | null;
  in?: boolean; // només per compatibilitat amb fitxers antics; no es fa servir
};

export type Planol = {
  v: 1;
  meta: { title: string; date: string; venue: string };
  zones: Zona[];
  els: Element[];
  people: Persona[];
  seq: number;
};

// Noms per defecte en català: són dades de l'usuari, no textos de la
// interfície (es poden reanomenar). L'app els crea en l'idioma de qui crea
// el plànol (vegeu zonesPerDefecte).
export const COLORS_ZONES = {
  aut: "#A81D2D",
  org: "#6A4AA8",
  pre: "#2C5AA0",
  res: "#C08400",
  pmr: "#116C66",
} as const;

export function planolBuit(zones: Zona[]): Planol {
  return { v: 1, meta: { title: "", date: "", venue: "" }, zones, els: [], people: [], seq: 1 };
}

export function uid(S: Planol, prefix: string): string {
  return prefix + S.seq++;
}

// Accepta un objecte desconegut (de la base de dades o d'un fitxer) i el
// torna com a Planol, o null si no ho sembla. No valida a fons: el document
// el genera la mateixa app.
export function llegeixPlanol(o: unknown, zones: Zona[]): Planol | null {
  if (!o || typeof o !== "object") return null;
  const x = o as Partial<Planol>;
  if (!Array.isArray(x.els) || !Array.isArray(x.people)) return null;
  const maxSeq = [...x.els.map((e) => e.id), ...x.people.map((p) => p.id)]
    .map((id) => parseInt(String(id).slice(1), 10))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0);
  return {
    v: 1,
    meta: { title: "", date: "", venue: "", ...(x.meta ?? {}) },
    zones: Array.isArray(x.zones) && x.zones.length ? x.zones : zones,
    els: x.els,
    people: x.people.map((p) => ({ ...p, in: undefined })),
    seq: Math.max(Number(x.seq) || 1, maxSeq + 1),
  };
}

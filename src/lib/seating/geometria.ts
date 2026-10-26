// Geometria dels elements: cada tipus genera els seus seients.
// Portat de seating.html sense canviar-ne el comportament.
// x,y són locals a l'element; l'element té posició i rotació pròpies.

import type { Element, Persona, Planol, Seient, TipusElement } from "./model.ts";
import { uid } from "./model.ts";

export const SEAT = 26;

export type PuntSeient = { x: number; y: number; rot: number; label: string; r?: number; c?: number };

export const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function rowLabel(i: number, kind: "alpha" | "num"): string {
  if (kind === "num") return String(i + 1);
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// Noms per defecte dels elements nous (en l'idioma de la interfície).
export type NomsElements = Record<TipusElement, string>;

export function makeEl(S: Planol, type: TipusElement, noms: NomsElements): Element {
  const base = { id: uid(S, "e"), x: 0, y: 0, rot: 0, name: noms[type], code: "", seats: [] as Seient[] };
  let el: Element;
  switch (type) {
    case "rows":
      el = { ...base, type, p: { rows: 6, cols: 12, gapX: 8, gapY: 14, aisles: "", curve: 0, rowKind: "alpha", numbering: "ltr" } };
      break;
    case "round":
      el = { ...base, type, code: "T", p: { n: 8, r: 58 } };
      break;
    case "rect":
      el = { ...base, type, code: "R", p: { w: 180, h: 80, top: 5, bottom: 5, left: 1, right: 1 } };
      break;
    case "head":
      el = { ...base, type, code: "P", p: { n: 5, pitch: 46 } };
      break;
    case "shape":
      el = { ...base, type, p: { w: 260, h: 64, kind: "escenari" } };
      break;
  }
  el.seats = geom(el).map((g, i) => ({ i, label: g.label, tag: null, blocked: false, person: null }));
  return el;
}

export function geom(el: Element): PuntSeient[] {
  const out: PuntSeient[] = [];
  if (el.type === "rows") {
    const p = el.p;
    const cols = clampN(Math.round(p.cols), 1, 60);
    const rows = clampN(Math.round(p.rows), 1, 60);
    const aisles = String(p.aisles || "")
      .split(",")
      .map((s) => parseInt(s, 10))
      .filter((n) => n > 0 && n < cols);
    const AW = 34;
    const xs: number[] = [];
    let cur = 0;
    for (let c = 0; c < cols; c++) {
      xs.push(cur);
      cur += SEAT + p.gapX + (aisles.includes(c + 1) ? AW : 0);
    }
    const totalW = cur - p.gapX;
    const half = Math.max(totalW / 2, 1);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = xs[c] - totalW / 2 + SEAT / 2;
        const t = x / half;
        // La corba envolta l'escenari: els extrems s'hi acosten (y menor), no s'allunyen.
        const dy = -(p.curve || 0) * t * t;
        const slope = (-2 * (p.curve || 0) * x) / (half * half);
        const y = r * (SEAT + p.gapY) + dy;
        let n: number;
        if (p.numbering === "center") {
          // senars cap a l'esquerra del públic, parells cap a la dreta, creixent des del centre
          const mid = (cols - 1) / 2;
          n = cols % 2 === 1 ? (c <= mid ? 2 * (mid - c) + 1 : 2 * (c - mid)) : c < mid ? 2 * (mid - c) : 2 * (c - mid) + 1;
        } else n = c + 1;
        out.push({ x, y, r, c, rot: (Math.atan(slope) * 180) / Math.PI, label: (el.code || "") + rowLabel(r, p.rowKind) + n });
      }
    }
  } else if (el.type === "round") {
    const n = clampN(Math.round(el.p.n), 1, 30);
    const R = el.p.r + SEAT / 2 + 8;
    for (let i = 0; i < n; i++) {
      const a = -90 + (i * 360) / n;
      const ra = (a * Math.PI) / 180;
      out.push({ x: R * Math.cos(ra), y: R * Math.sin(ra), rot: a + 90, label: (el.code || "") + (i + 1) });
    }
  } else if (el.type === "rect") {
    const { w, h } = el.p;
    const o = SEAT / 2 + 10;
    const sides: { x: number; y: number; rot: number }[] = [];
    const spread = (count: number, len: number) => {
      const a: number[] = [];
      for (let i = 0; i < count; i++) a.push(-len / 2 + (len * (i + 0.5)) / count);
      return a;
    };
    spread(Math.max(0, Math.round(el.p.top)), w).forEach((x) => sides.push({ x, y: -h / 2 - o, rot: 180 }));
    spread(Math.max(0, Math.round(el.p.right)), h).forEach((y) => sides.push({ x: w / 2 + o, y, rot: 270 }));
    spread(Math.max(0, Math.round(el.p.bottom)), w).reverse().forEach((x) => sides.push({ x, y: h / 2 + o, rot: 0 }));
    spread(Math.max(0, Math.round(el.p.left)), h).reverse().forEach((y) => sides.push({ x: -w / 2 - o, y, rot: 90 }));
    sides.forEach((s, i) => out.push({ ...s, label: (el.code || "") + (i + 1) }));
  } else if (el.type === "head") {
    const n = clampN(Math.round(el.p.n), 1, 25);
    for (let i = 0; i < n; i++) out.push({ x: (i - (n - 1) / 2) * el.p.pitch, y: 0, rot: 0, label: (el.code || "") + (i + 1) });
  }
  return out;
}

// Regenera seients conservant zona/bloqueig/ocupant per ETIQUETA: si afegeixes
// una fila o una cadira, ningú no es desplaça. Si canvia l'esquema
// d'etiquetes, es cau a l'índex. Torna quantes persones s'han quedat sense seient.
export function rebuild(S: Planol, el: Element): number {
  const g = geom(el);
  const old = el.seats || [];
  const byLabel = new Map<string, Seient>();
  old.forEach((s) => {
    if (!byLabel.has(s.label)) byLabel.set(s.label, s);
  });
  el.seats = g.map((s, i) => {
    const o = byLabel.get(s.label) || old[i];
    return { i, label: s.label, tag: o ? o.tag : null, blocked: o ? o.blocked : false, person: o ? o.person : null };
  });
  const seen = new Set<string>();
  el.seats.forEach((s) => {
    if (!s.person) return;
    if (seen.has(s.person)) s.person = null;
    else seen.add(s.person);
  });
  // Refà els punters persona -> seient a partir dels seients
  S.people.forEach((pe) => {
    if (pe.seat && pe.seat.el === el.id) pe.seat = null;
  });
  el.seats.forEach((s) => {
    if (!s.person) return;
    const pe = S.people.find((x) => x.id === s.person);
    if (pe) pe.seat = { el: el.id, i: s.i };
    else s.person = null;
  });
  const before = new Set(old.filter((s) => s.person).map((s) => s.person));
  const after = new Set(el.seats.filter((s) => s.person).map((s) => s.person));
  let lost = 0;
  before.forEach((id) => {
    if (!after.has(id)) lost++;
  });
  return lost;
}

export type Caixa = { x0: number; y0: number; x1: number; y1: number };

export function bbox(el: Element): Caixa {
  if (el.type === "shape") return { x0: -el.p.w / 2, y0: -el.p.h / 2, x1: el.p.w / 2, y1: el.p.h / 2 };
  const gs = geom(el);
  if (!gs.length) return { x0: -20, y0: -20, x1: 20, y1: 20 };
  const xs = gs.map((s) => s.x);
  const ys = gs.map((s) => s.y);
  const b = {
    x0: Math.min(...xs) - SEAT / 2,
    x1: Math.max(...xs) + SEAT / 2,
    y0: Math.min(...ys) - SEAT / 2,
    y1: Math.max(...ys) + SEAT / 2,
  };
  if (el.type === "round") {
    b.x0 = Math.min(b.x0, -el.p.r);
    b.x1 = Math.max(b.x1, el.p.r);
    b.y0 = Math.min(b.y0, -el.p.r);
    b.y1 = Math.max(b.y1, el.p.r);
  }
  if (el.type === "rect") {
    b.x0 = Math.min(b.x0, -el.p.w / 2);
    b.x1 = Math.max(b.x1, el.p.w / 2);
    b.y0 = Math.min(b.y0, -el.p.h / 2);
    b.y1 = Math.max(b.y1, el.p.h / 2);
  }
  if (el.type === "head") b.y1 = Math.max(b.y1, 46);
  return b;
}

export function worldBox(S: Planol): Caixa {
  if (!S.els.length) return { x0: -300, y0: -200, x1: 300, y1: 200 };
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  S.els.forEach((el) => {
    const b = bbox(el);
    const c = Math.cos((el.rot * Math.PI) / 180);
    const s = Math.sin((el.rot * Math.PI) / 180);
    [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].forEach(([px, py]) => {
      const X = el.x + px * c - py * s;
      const Y = el.y + px * s + py * c;
      x0 = Math.min(x0, X);
      x1 = Math.max(x1, X);
      y0 = Math.min(y0, Y);
      y1 = Math.max(y1, Y);
    });
  });
  return { x0, y0, x1, y1 };
}

// Posició d'un seient en coordenades del plànol.
export function posicioSeient(el: Element, i: number): { x: number; y: number } | null {
  const g = geom(el)[i];
  if (!g) return null;
  const c = Math.cos((el.rot * Math.PI) / 180);
  const s = Math.sin((el.rot * Math.PI) / 180);
  return { x: el.x + g.x * c - g.y * s, y: el.y + g.x * s + g.y * c };
}

// ------------------------------------------------------------------
// Persones i seients
// ------------------------------------------------------------------

export function orderedPeople(S: Planol): Persona[] {
  return [...S.people].sort((a, b) => (a.rank || 9999) - (b.rank || 9999) || a.name.localeCompare(b.name));
}

export function renumber(S: Planol) {
  orderedPeople(S).forEach((p, i) => (p.rank = i + 1));
}

export function seatLabelOf(S: Planol, p: Persona): string | null {
  if (!p.seat) return null;
  const e = S.els.find((x) => x.id === p.seat!.el);
  if (!e) return null;
  const s = e.seats[p.seat.i];
  return s ? s.label : null;
}

export function unassignSeat(S: Planol, s: Seient) {
  if (!s.person) return;
  const p = S.people.find((x) => x.id === s.person);
  if (p) p.seat = null;
  s.person = null;
}

export function assign(S: Planol, pid: string, el: Element, s: Seient) {
  const p = S.people.find((x) => x.id === pid);
  if (!p) return;
  if (p.seat) {
    const oe = S.els.find((x) => x.id === p.seat!.el);
    if (oe && oe.seats[p.seat.i]) oe.seats[p.seat.i].person = null;
  }
  if (s.person) {
    const op = S.people.find((x) => x.id === s.person);
    if (op) op.seat = null;
  }
  s.person = p.id;
  p.seat = { el: el.id, i: s.i };
}

export function eliminaElement(S: Planol, id: string) {
  const el = S.els.find((e) => e.id === id);
  if (!el) return;
  el.seats.forEach((s) => unassignSeat(S, s));
  S.els = S.els.filter((e) => e.id !== id);
}

export function eliminaPersona(S: Planol, id: string) {
  const p = S.people.find((x) => x.id === id);
  if (p && p.seat) {
    const e = S.els.find((x) => x.id === p.seat!.el);
    if (e && e.seats[p.seat.i]) e.seats[p.seat.i].person = null;
  }
  S.people = S.people.filter((x) => x.id !== id);
  renumber(S);
}

export function comptes(S: Planol, arribats: Set<string>) {
  let total = 0, blocked = 0, taken = 0, arrived = 0;
  S.els.forEach((e) =>
    e.seats.forEach((s) => {
      total++;
      if (s.blocked) blocked++;
      else if (s.person) taken++;
      if (s.person && arribats.has(s.person)) arrived++;
    }),
  );
  return { total, blocked, taken, free: total - blocked - taken, arrived };
}

// Cognoms (o el nom, si només n'hi ha un) per escriure dins del seient.
export function short(name: string): string {
  const parts = String(name).trim().split(/\s+/);
  const s = parts.length > 1 ? parts.slice(1).join(" ") : parts[0];
  return s.length > 10 ? s.slice(0, 9) + "…" : s;
}

// Ordre de protocol i assignació automàtica. Portat de seating.html.
//
// Regla: la dreta de qui presideix és l'ESQUERRA del públic (x negatiu).
// Amb nombre parell, la presidència ocupa el seient central de la dreta del
// públic (o de l'esquerra, segons la convenció de cada casa: `parell`).

import type { Element, Planol } from "./model.ts";
import { assign, geom, orderedPeople } from "./geometria.ts";

export type Estrategia = "alternada" | "lateral";
export type Parell = "right" | "left";

export function alternate(n: number, c: number, circular: boolean): number[] {
  const ord = [c];
  const seen = new Set([c]);
  let l = c - 1, r = c + 1, guard = 0;
  const put = (i: number) => {
    if (!seen.has(i) && ord.length < n) {
      ord.push(i);
      seen.add(i);
    }
  };
  while (ord.length < n && guard++ < 4 * n + 8) {
    if (circular) {
      put((((l--) % n) + n) % n);
      put((((r++) % n) + n) % n);
    } else {
      if (l >= 0) put(l--);
      if (r < n) put(r++);
    }
  }
  return ord;
}

// Índexs de seient en l'ordre en què s'han d'ocupar.
export function seatOrder(el: Element, strat: Estrategia, parell: Parell): number[] {
  const g = geom(el);
  const idx = el.seats.map((s) => s.i).filter((i) => g[i]);
  if (!idx.length) return [];
  if (el.type === "round" || el.type === "rect") {
    if (strat === "lateral") return idx;
    // Cap de taula = el seient de la banda de dalt més a prop de l'eix,
    // no el de la cantonada. La resta, alternant al voltant de la taula.
    const ymin = Math.min(...idx.map((i) => g[i].y));
    const topRow = idx.filter((i) => g[i].y <= ymin + 12);
    const head = topRow.reduce((b, i) => (Math.abs(g[i].x) < Math.abs(g[b].x) ? i : b), topRow[0]);
    return alternate(idx.length, idx.indexOf(head), true).map((i) => idx[i]);
  }
  // rows / head: agrupa per fila REAL (amb corbatura, la y ja no serveix per agrupar)
  const rows = new Map<number, number[]>();
  idx.forEach((i) => {
    const k = el.type === "rows" && g[i].r !== undefined ? g[i].r! : 0;
    if (!rows.has(k)) rows.set(k, []);
    rows.get(k)!.push(i);
  });
  const out: number[] = [];
  [...rows.keys()]
    .sort((a, b) => a - b)
    .forEach((k) => {
      const r = rows.get(k)!.sort((a, b) => g[a].x - g[b].x);
      if (strat === "lateral") out.push(...r);
      else {
        const c = parell === "left" ? Math.ceil(r.length / 2) - 1 : Math.floor(r.length / 2);
        out.push(...alternate(r.length, c, false).map((i) => r[i]));
      }
    });
  return out;
}

export type OpcionsAuto = {
  el: string;
  ordre: Estrategia;
  qui: "free" | "all";
  parell: Parell;
  zona: string; // '' = seients sense zona
  respecta: boolean; // no ocupar seients d'altres zones
};

export type ResultatAuto = { n: number } | { error: "ningu" | "sense_seients" | "sense_element" };

export function autoAssign(S: Planol, o: OpcionsAuto): ResultatAuto {
  const el = S.els.find((e) => e.id === o.el);
  if (!el) return { error: "sense_element" };
  const order = seatOrder(el, o.ordre, o.parell).filter((i) => {
    const s = el.seats[i];
    if (s.blocked) return false;
    if (o.zona) return s.tag === o.zona; // només aquella zona
    if (o.respecta && s.tag) return false; // no toquis premsa, reservats, PMR...
    return true;
  });
  let people = orderedPeople(S);
  if (o.qui === "free") people = people.filter((p) => !p.seat);
  if (!people.length) return { error: "ningu" };
  if (!order.length) return { error: "sense_seients" };

  let n = 0;
  for (const p of people) {
    while (order.length && el.seats[order[0]].person && el.seats[order[0]].person !== p.id) order.shift();
    if (!order.length) break;
    assign(S, p.id, el, el.seats[order.shift()!]);
    n++;
  }
  return { n };
}

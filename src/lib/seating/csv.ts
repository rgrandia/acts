// Importació de convidats des d'un CSV o un llistat enganxat. Portat de
// seating.html. Reconeix capçaleres en català, castellà i anglès.

import type { Planol } from "./model.ts";
import { renumber } from "./geometria.ts";
import { uid } from "./model.ts";

export function splitLine(line: string, d: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === d && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const NORM = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const KEYS: Record<"name" | "last" | "role" | "org" | "group" | "rank", string[]> = {
  name: ["nom", "nombre", "name", "nom i cognoms", "nom complet"],
  last: ["cognom", "cognoms", "apellido", "apellidos", "surname"],
  role: ["carrec", "cargo", "role", "rol", "posicio", "posicion"],
  org: ["entitat", "entidad", "org", "organitzacio", "organizacion", "institucio", "institucion", "partit", "empresa"],
  group: ["grup", "grupo", "group", "bloc"],
  rank: ["ordre", "orden", "rank", "precedencia", "prioritat", "num", "n"],
};

// Afegeix les persones del text al plànol. Torna quantes n'ha afegit.
export function parseCSV(S: Planol, text: string): number {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return 0;
  const counts = ([";", ",", "\t"] as const).map(
    (d) => [d, (lines[0].match(new RegExp(d === "\t" ? "\t" : "\\" + d, "g")) || []).length] as const,
  );
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  const d = sorted[0][1] ? sorted[0][0] : ";";
  const head = splitLine(lines[0], d).map(NORM);
  const map: Partial<Record<keyof typeof KEYS, number>> = {};
  (Object.keys(KEYS) as (keyof typeof KEYS)[]).forEach((k) => {
    const i = head.findIndex((h) => KEYS[k].includes(h));
    if (i >= 0) map[k] = i;
  });
  const hasHeader = Object.keys(map).length > 0;
  const rows = hasHeader ? lines.slice(1) : lines;
  let n = 0;
  rows.forEach((l) => {
    const c = splitLine(l, d);
    let name = hasHeader ? c[map.name ?? -1] || "" : c[0];
    if (hasHeader && map.last !== undefined && c[map.last]) name = (name + " " + c[map.last]).trim();
    name = (name || "").trim();
    if (!name) return;
    const rank = hasHeader && map.rank !== undefined ? parseInt(c[map.rank], 10) : NaN;
    const camp = (k: "role" | "org" | "group", posicio: number) =>
      hasHeader ? (map[k] !== undefined ? c[map[k]!] || "" : "") : k === "group" ? "" : c[posicio] || "";
    S.people.push({
      id: uid(S, "p"),
      name,
      role: camp("role", 1),
      org: camp("org", 2),
      group: camp("group", 3),
      rank: Number.isFinite(rank) ? rank : S.people.length + 1,
      seat: null,
    });
    n++;
  });
  if (n) renumber(S);
  return n;
}

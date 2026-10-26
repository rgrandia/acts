// Proves de la lògica del seating (geometria, protocol, CSV). Sense
// dependències: node --experimental-strip-types scripts/prova-seating.mts
import assert from "node:assert/strict";
import { planolBuit, llegeixPlanol } from "../src/lib/seating/model.ts";
import { makeEl, geom, rebuild, assign, eliminaElement, seatLabelOf, comptes } from "../src/lib/seating/geometria.ts";
import { alternate, seatOrder, autoAssign } from "../src/lib/seating/protocol.ts";
import { parseCSV } from "../src/lib/seating/csv.ts";

const NOMS = { rows: "Platea", round: "Taula", rect: "Taula rect.", head: "Presidència", shape: "Escenari" };
const nou = () => planolBuit([{ id: "aut", name: "Autoritats", color: "#A81D2D" }]);
let proves = 0;
const prova = (nom: string, f: () => void) => {
  f();
  proves++;
};

prova("alternate lineal i circular", () => {
  assert.deepEqual(alternate(5, 2, false), [2, 1, 3, 0, 4]);
  assert.deepEqual(alternate(4, 2, false), [2, 1, 3, 0]);
  assert.deepEqual(alternate(6, 0, true), [0, 5, 1, 4, 2, 3]);
});

prova("presidència de 5: centre, després la dreta de qui presideix (esquerra del públic)", () => {
  const S = nou();
  const el = makeEl(S, "head", NOMS);
  const g = geom(el);
  const ordre = seatOrder(el, "alternada", "right");
  assert.equal(g[ordre[0]].x, 0, "el primer és el centre");
  assert.ok(g[ordre[1]].x < 0, "el segon, a l'esquerra del públic");
  assert.ok(g[ordre[2]].x > 0, "el tercer, a la dreta del públic");
  assert.deepEqual(ordre.map((i) => el.seats[i].label), ["P3", "P2", "P4", "P1", "P5"]);
});

prova("presidència parella: la convenció decideix el centre", () => {
  const S = nou();
  const el = makeEl(S, "head", NOMS);
  el.p.n = 4;
  rebuild(S, el);
  const g = geom(el);
  assert.ok(g[seatOrder(el, "alternada", "right")[0]].x > 0, "centre-dreta del públic");
  assert.ok(g[seatOrder(el, "alternada", "left")[0]].x < 0, "centre-esquerra del públic");
});

prova("taula rodona: el cap és el seient de dalt", () => {
  const S = nou();
  const el = makeEl(S, "round", NOMS);
  const g = geom(el);
  const ordre = seatOrder(el, "alternada", "right");
  assert.equal(ordre.length, 8);
  assert.equal(ordre[0], 0);
  assert.ok(g[0].y < 0 && Math.abs(g[0].x) < 1e-9);
});

prova("files: etiquetes i numeració des del centre", () => {
  const S = nou();
  const el = makeEl(S, "rows", NOMS);
  el.p.rows = 2;
  el.p.cols = 5;
  el.p.numbering = "center";
  rebuild(S, el);
  assert.deepEqual(el.seats.slice(0, 5).map((s) => s.label), ["A5", "A3", "A1", "A2", "A4"], "senars a l'esquerra del públic");
  assert.equal(el.seats[5].label, "B5");
});

prova("rebuild conserva qui seu per etiqueta en afegir cadires", () => {
  const S = nou();
  const el = makeEl(S, "rows", NOMS);
  S.els.push(el);
  parseCSV(S, "Anna Puig\nMarc Solé");
  assign(S, S.people[0].id, el, el.seats[0]); // A1
  el.p.cols = 14;
  const perduts = rebuild(S, el);
  assert.equal(perduts, 0);
  assert.equal(seatLabelOf(S, S.people[0]), "A1");
  el.p.rows = 1;
  el.p.cols = 1;
  assert.equal(rebuild(S, el), 0, "A1 encara existeix");
});

prova("CSV amb capçaleres en castellà i separador ;", () => {
  const S = nou();
  const n = parseCSV(S, "nombre;apellidos;cargo;entidad;orden\nAnna;Puig;Alcaldesa;Ajuntament;2\nMarc;Solé;Regidor;Ajuntament;1");
  assert.equal(n, 2);
  assert.equal(S.people.find((p) => p.rank === 1)!.name, "Marc Solé", "precedència de la columna orden");
  assert.equal(S.people.find((p) => p.name === "Anna Puig")!.role, "Alcaldesa");
});

prova("CSV sense capçalera i amb cometes", () => {
  const S = nou();
  assert.equal(parseCSV(S, '"Puig, Anna",Alcaldessa,"Ajuntament de Girona"'), 1);
  assert.equal(S.people[0].name, "Puig, Anna");
  assert.equal(S.people[0].org, "Ajuntament de Girona");
});

prova("assignació automàtica per protocol respecta zones i bloquejos", () => {
  const S = nou();
  const el = makeEl(S, "head", NOMS);
  S.els.push(el);
  el.seats[2].blocked = true; // el centre
  el.seats[1].tag = "aut";
  parseCSV(S, "nom;ordre\nPrimera;1\nSegona;2\nTercera;3");
  const r = autoAssign(S, { el: el.id, ordre: "alternada", qui: "free", parell: "right", zona: "", respecta: true });
  assert.deepEqual(r, { n: 3 });
  // Ordre P3(bloquejat) P2(zona) P4 P1 P5 → queden P4, P1, P5
  assert.deepEqual(S.people.map((p) => seatLabelOf(S, p)), ["P4", "P1", "P5"]);
  assert.deepEqual(comptes(S, new Set([S.people[0].id])), { total: 5, blocked: 1, taken: 3, free: 1, arrived: 1 });
});

prova("eliminar un element allibera les persones", () => {
  const S = nou();
  const el = makeEl(S, "round", NOMS);
  S.els.push(el);
  parseCSV(S, "Anna");
  assign(S, S.people[0].id, el, el.seats[3]);
  eliminaElement(S, el.id);
  assert.equal(S.people[0].seat, null);
});

prova("llegeix un fitxer de l'eina antiga i recalcula el comptador", () => {
  const vell = { v: 1, meta: { title: "Acte" }, els: [{ id: "e7" }], people: [{ id: "p12", name: "X", in: true }], seq: 3 };
  const S = llegeixPlanol(vell, [])!;
  assert.equal(S.seq, 13, "no ha de repetir identificadors");
  assert.equal(S.people[0].in, undefined, "les arribades no venen del fitxer");
  assert.equal(llegeixPlanol({ foo: 1 }, []), null);
});

console.log(`seating: ${proves} proves correctes`);

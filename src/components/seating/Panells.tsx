"use client";

import { useState } from "react";
import type { Diccionari } from "@/i18n/ca";
import { fmt } from "@/i18n/format";
import type { Element, Planol, TipusElement } from "@/lib/seating/model.ts";
import { uid } from "@/lib/seating/model.ts";
import { eliminaElement, eliminaPersona, orderedPeople, seatLabelOf, unassignSeat } from "@/lib/seating/geometria.ts";
import { autoAssign, type OpcionsAuto } from "@/lib/seating/protocol.ts";

// Única manera de modificar el document: apunta l'estat per desfer (tret
// que es demani el contrari, p. ex. mentre s'arrossega un control lliscant),
// aplica el canvi, redibuixa i programa el desat.
export type Muta = (f: (S: Planol) => void, opcions?: { historial?: boolean }) => void;

type Comu = {
  S: Planol;
  t: Diccionari["seating"];
  muta: Muta;
  avisa: (m: string) => void;
};

// Camp de text o número que aplica el canvi en sortir-ne o amb Enter (com
// l'esdeveniment `change` de l'original): una entrada a l'historial per
// canvi, no una per tecla.
function Camp({
  etiqueta,
  valor,
  tipus = "text",
  min,
  max,
  onCanvi,
}: {
  etiqueta: string;
  valor: string | number;
  tipus?: "text" | "number";
  min?: number;
  max?: number;
  onCanvi: (v: string) => void;
}) {
  const aplica = (v: string) => {
    if (v !== String(valor)) onCanvi(v);
  };
  return (
    <div className="st-field">
      <label>
        {etiqueta}
        {/* key: si el valor canvia per una altra via (desfer), el camp es refà */}
        <input
          key={String(valor)}
          type={tipus}
          min={min}
          max={max}
          defaultValue={String(valor)}
          onBlur={(e) => aplica(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && aplica(e.currentTarget.value)}
        />
      </label>
    </div>
  );
}

function Seleccio({ etiqueta, valor, opcions, onCanvi }: { etiqueta: string; valor: string; opcions: [string, string][]; onCanvi: (v: string) => void }) {
  return (
    <div className="st-field">
      <label>
        {etiqueta}
        <select value={valor} onChange={(e) => onCanvi(e.target.value)}>
          {opcions.map(([v, text]) => (
            <option key={v} value={v}>{text}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Casella({ etiqueta, valor, onCanvi }: { etiqueta: string; valor: boolean; onCanvi: (v: boolean) => void }) {
  return (
    <label className="st-hint st-check">
      <input type="checkbox" checked={valor} onChange={(e) => onCanvi(e.target.checked)} /> {etiqueta}
    </label>
  );
}

const num = (v: string, d: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : d;
};

// ====================================================================
// Muntatge
// ====================================================================
export function PanellMuntatge({
  S,
  t,
  muta,
  sel,
  setSel,
  brush,
  setBrush,
  snap,
  setSnap,
  afegeix,
  centra,
  rebuild,
}: Comu & {
  sel: string | null;
  setSel: (id: string | null) => void;
  brush: string | null;
  setBrush: (b: string | null) => void;
  snap: boolean;
  setSnap: (v: boolean) => void;
  afegeix: (tipus: TipusElement) => void;
  centra: (x: number, y: number) => void;
  rebuild: (S: Planol, el: Element) => void;
}) {
  const tm = t.muntatge;
  const el = S.els.find((e) => e.id === sel);
  const tipus: TipusElement[] = ["rows", "round", "rect", "head", "shape"];

  // Canvi d'una propietat de l'element seleccionat.
  const canviaEl = (f: (el: Element, S: Planol) => void, historial = true) =>
    muta(
      (S) => {
        const e = S.els.find((x) => x.id === sel);
        if (e) f(e, S);
      },
      { historial },
    );
  // Canvi d'un paràmetre de geometria: regenera els seients.
  const pp = (k: string, v: string | number, historial = true) =>
    canviaEl((e, S) => {
      (e.p as Record<string, unknown>)[k] = v;
      rebuild(S, e);
    }, historial);
  const ppNum = (k: string, actual: number) => (v: string) => pp(k, num(v, actual));
  // Un control lliscant: una sola entrada a l'historial per gest.
  const [lliscant, setLliscant] = useState(false);
  const iniciaLliscament = () => {
    if (lliscant) return;
    muta(() => {});
    setLliscant(true);
  };

  return (
    <>
      <div className="st-sec">
        <h3>{tm.afegeix}</h3>
        <div className="st-grid2">
          {tipus.map((k) => (
            <button key={k} className="st-btn" onClick={() => afegeix(k)}>{tm[k]}</button>
          ))}
          <button
            className="st-btn"
            disabled={!el}
            onClick={() => {
              let nou = "";
              canviaEl((e, S) => {
                const c = JSON.parse(JSON.stringify(e)) as Element;
                c.id = uid(S, "e");
                c.x += 40;
                c.y += 40;
                c.seats.forEach((s) => (s.person = null));
                S.els.push(c);
                nou = c.id;
              });
              if (nou) setSel(nou);
            }}
          >
            {tm.duplica}
          </button>
        </div>
      </div>

      <div className="st-sec">
        <h3>{tm.zones}</h3>
        <div className="st-hint" style={{ marginBottom: 7 }}>{tm.ajudaPinzell}</div>
        <div className="st-chips">
          {S.zones.map((z) => (
            <button key={z.id} className="st-chip" aria-pressed={brush === z.id} onClick={() => setBrush(brush === z.id ? null : z.id)}>
              <i style={{ background: z.color }} />
              {z.name}
            </button>
          ))}
          <button className="st-chip" aria-pressed={brush === "block"} onClick={() => setBrush(brush === "block" ? null : "block")}>
            <i style={{ background: "#DCD7CB" }} />
            {tm.bloqueja}
          </button>
          {brush && (
            <button className="st-chip" onClick={() => setBrush(null)}>{tm.deixaPinzell}</button>
          )}
        </div>
      </div>

      <div className="st-sec">
        <h3>{tm.elements}</h3>
        {S.els.length ? (
          <div className="st-list">
            {S.els.map((e) => (
              <button key={e.id} className="st-row" aria-pressed={e.id === sel} onClick={() => setSel(e.id)}>
                <span className="st-nm">{e.name || tm.senseNom}</span>
                <span className="st-sub">{e.seats.length ? fmt(t.llista.seients, { n: e.seats.length }) : "—"}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="st-empty">{tm.buit}</div>
        )}
      </div>

      {el && (
        <div className="st-sec" key={el.id}>
          <h3>{el.name || tm.element}</h3>
          <Camp
            etiqueta={tm.nom}
            valor={el.name}
            onCanvi={(v) => canviaEl((e) => (e.name = v))}
          />
          {el.type !== "shape" && (
            <Camp
              etiqueta={tm.prefix}
              valor={el.code}
              onCanvi={(v) =>
                canviaEl((e, S) => {
                  e.code = v;
                  rebuild(S, e);
                })
              }
            />
          )}

          {el.type === "rows" && (
            <>
              <div className="st-grid2">
                <Camp etiqueta={tm.files} tipus="number" min={1} max={60} valor={el.p.rows} onCanvi={ppNum("rows", el.p.rows)} />
                <Camp etiqueta={tm.cadiresFila} tipus="number" min={1} max={60} valor={el.p.cols} onCanvi={ppNum("cols", el.p.cols)} />
              </div>
              <Camp etiqueta={tm.passadissos} valor={el.p.aisles} onCanvi={(v) => pp("aisles", v)} />
              <div className="st-grid2">
                <Camp etiqueta={tm.sepLateral} tipus="number" min={0} max={40} valor={el.p.gapX} onCanvi={ppNum("gapX", el.p.gapX)} />
                <Camp etiqueta={tm.sepFiles} tipus="number" min={0} max={60} valor={el.p.gapY} onCanvi={ppNum("gapY", el.p.gapY)} />
              </div>
              <div className="st-field">
                <label>
                  {fmt(tm.corbatura, { n: el.p.curve })}
                  <input
                    type="range"
                    min={0}
                    max={120}
                    value={el.p.curve}
                    onPointerDown={iniciaLliscament}
                    onPointerUp={() => setLliscant(false)}
                    onChange={(e) => pp("curve", num(e.target.value, 0), false)}
                  />
                </label>
              </div>
              <div className="st-grid2">
                <Seleccio
                  etiqueta={tm.files}
                  valor={el.p.rowKind}
                  opcions={[["alpha", tm.lletres], ["num", tm.numeros]]}
                  onCanvi={(v) => pp("rowKind", v)}
                />
                <Seleccio
                  etiqueta={tm.numeracio}
                  valor={el.p.numbering}
                  opcions={[["ltr", tm.correlativa], ["center", tm.desDelCentre]]}
                  onCanvi={(v) => pp("numbering", v)}
                />
              </div>
            </>
          )}

          {el.type === "round" && (
            <div className="st-grid2">
              <Camp etiqueta={tm.comensals} tipus="number" min={1} max={30} valor={el.p.n} onCanvi={ppNum("n", el.p.n)} />
              <Camp etiqueta={tm.radi} tipus="number" min={20} max={200} valor={el.p.r} onCanvi={ppNum("r", el.p.r)} />
            </div>
          )}

          {el.type === "rect" && (
            <>
              <div className="st-grid2">
                <Camp etiqueta={tm.amplada} tipus="number" min={40} max={600} valor={el.p.w} onCanvi={ppNum("w", el.p.w)} />
                <Camp etiqueta={tm.fondaria} tipus="number" min={30} max={400} valor={el.p.h} onCanvi={ppNum("h", el.p.h)} />
              </div>
              <div className="st-grid2">
                <Camp etiqueta={tm.dalt} tipus="number" min={0} max={30} valor={el.p.top} onCanvi={ppNum("top", el.p.top)} />
                <Camp etiqueta={tm.baix} tipus="number" min={0} max={30} valor={el.p.bottom} onCanvi={ppNum("bottom", el.p.bottom)} />
                <Camp etiqueta={tm.esquerra} tipus="number" min={0} max={15} valor={el.p.left} onCanvi={ppNum("left", el.p.left)} />
                <Camp etiqueta={tm.dreta} tipus="number" min={0} max={15} valor={el.p.right} onCanvi={ppNum("right", el.p.right)} />
              </div>
            </>
          )}

          {el.type === "head" && (
            <>
              <div className="st-grid2">
                <Camp etiqueta={tm.llocs} tipus="number" min={1} max={25} valor={el.p.n} onCanvi={ppNum("n", el.p.n)} />
                <Camp etiqueta={tm.separacio} tipus="number" min={30} max={90} valor={el.p.pitch} onCanvi={ppNum("pitch", el.p.pitch)} />
              </div>
              <div className="st-hint">{tm.ajudaPresidencia}</div>
            </>
          )}

          {el.type === "shape" && (
            <>
              <Seleccio
                etiqueta={tm.tipus}
                valor={el.p.kind}
                opcions={[["escenari", tm.escenari], ["objecte", tm.objecte]]}
                onCanvi={(v) => pp("kind", v)}
              />
              <div className="st-grid2">
                <Camp etiqueta={tm.amplada} tipus="number" min={20} max={900} valor={el.p.w} onCanvi={ppNum("w", el.p.w)} />
                <Camp etiqueta={tm.alcada} tipus="number" min={20} max={600} valor={el.p.h} onCanvi={ppNum("h", el.p.h)} />
              </div>
            </>
          )}

          <div className="st-field">
            <label>
              {fmt(tm.gir, { n: el.rot })}
              <input
                type="range"
                min={-180}
                max={180}
                step={5}
                value={el.rot}
                onPointerDown={iniciaLliscament}
                onPointerUp={() => setLliscant(false)}
                onChange={(e) => {
                  const v = num(e.target.value, 0);
                  canviaEl((x) => (x.rot = v), false);
                }}
              />
            </label>
          </div>
          <div className="st-grid2" style={{ marginTop: 8 }}>
            <button className="st-btn" onClick={() => centra(el.x, el.y)}>{tm.centra}</button>
            <button
              className="st-btn st-danger"
              onClick={() => {
                muta((S) => eliminaElement(S, el.id));
                setSel(null);
              }}
            >
              {tm.elimina}
            </button>
          </div>
        </div>
      )}

      <div className="st-sec">
        <h3>{tm.vista}</h3>
        <Casella etiqueta={tm.quadricula} valor={snap} onCanvi={setSnap} />
      </div>
    </>
  );
}

// ====================================================================
// Assignació
// ====================================================================
export function PanellAssignacio({
  S,
  t,
  muta,
  avisa,
  selPerson,
  setSelPerson,
  aState,
  setAState,
  showOrder,
  setShowOrder,
  showNames,
  setShowNames,
  obreDialeg,
}: Comu & {
  selPerson: string | null;
  setSelPerson: (id: string | null) => void;
  aState: Omit<OpcionsAuto, "el"> & { el: string | null };
  setAState: (c: Partial<OpcionsAuto>) => void;
  showOrder: boolean;
  setShowOrder: (v: boolean) => void;
  showNames: boolean;
  setShowNames: (v: boolean) => void;
  obreDialeg: (d: "persona" | "csv") => void;
}) {
  const ta = t.assignacio;
  const [q, setQ] = useState("");
  const els = S.els.filter((e) => e.seats.length);
  const list = orderedPeople(S);
  const ql = q.toLowerCase();
  const shown = list.filter((p) => !ql || p.name.toLowerCase().includes(ql) || (p.org || "").toLowerCase().includes(ql));
  const p = S.people.find((x) => x.id === selPerson);

  const mouPrecedencia = (d: number) => {
    const i = list.findIndex((x) => x.id === selPerson);
    const j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return;
    muta((S) => {
      const ordre = orderedPeople(S);
      [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
      ordre.forEach((x, k) => (x.rank = k + 1));
    });
  };

  return (
    <>
      <div className="st-sec">
        <h3>{ta.convidats}</h3>
        <div className="st-grid2" style={{ marginBottom: 8 }}>
          <button className="st-btn" onClick={() => obreDialeg("csv")}>{ta.importaCsv}</button>
          <button className="st-btn" onClick={() => obreDialeg("persona")}>{ta.afegeixPersona}</button>
        </div>
        <input type="search" placeholder={ta.cerca} aria-label={ta.cerca} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
        {shown.length ? (
          <div className="st-list">
            {shown.map((x) => {
              const sl = seatLabelOf(S, x);
              return (
                <button
                  key={x.id}
                  className="st-row"
                  aria-pressed={x.id === selPerson}
                  onClick={() => setSelPerson(selPerson === x.id ? null : x.id)}
                >
                  <span className="st-rank">{x.rank || ""}</span>
                  <span className="st-nm">
                    {x.name}
                    {(x.role || x.org) && <span className="st-sub st-block">{[x.role, x.org].filter(Boolean).join(" · ")}</span>}
                  </span>
                  <span className={`st-seat ${sl ? "" : "none"}`}>{sl || "—"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="st-empty">{ta.cap}</div>
        )}
        <div className="st-hint" style={{ marginTop: 7 }}>{ta.ajuda}</div>
      </div>

      {p && (
        <div className="st-sec">
          <h3>{ta.seleccionat}</h3>
          <div className="st-stack">
            <div className="st-hint">
              <b>{p.name}</b>
              {p.role ? " — " + p.role : ""}
            </div>
            <div className="st-grid3">
              <button className="st-btn st-sm" onClick={() => mouPrecedencia(-1)}>{ta.amunt}</button>
              <button className="st-btn st-sm" onClick={() => mouPrecedencia(1)}>{ta.avall}</button>
              <button
                className="st-btn st-sm st-danger"
                onClick={() => {
                  muta((S) => eliminaPersona(S, p.id));
                  setSelPerson(null);
                }}
              >
                {ta.elimina}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="st-sec">
        <h3>{ta.auto}</h3>
        <Seleccio
          etiqueta={ta.element}
          valor={aState.el ?? ""}
          opcions={els.map((e) => [e.id, `${e.name} (${e.seats.length})`])}
          onCanvi={(v) => setAState({ el: v })}
        />
        <Seleccio
          etiqueta={ta.ordre}
          valor={aState.ordre}
          opcions={[["alternada", ta.protocol], ["lateral", ta.lineal]]}
          onCanvi={(v) => setAState({ ordre: v as OpcionsAuto["ordre"] })}
        />
        <Seleccio
          etiqueta={ta.persones}
          valor={aState.qui}
          opcions={[["free", ta.nomesSense], ["all", ta.totes]]}
          onCanvi={(v) => setAState({ qui: v as OpcionsAuto["qui"] })}
        />
        <Seleccio
          etiqueta={ta.parell}
          valor={aState.parell}
          opcions={[["right", ta.parellDreta], ["left", ta.parellEsquerra]]}
          onCanvi={(v) => setAState({ parell: v as OpcionsAuto["parell"] })}
        />
        <Seleccio
          etiqueta={ta.zona}
          valor={aState.zona}
          opcions={[["", ta.senseZona], ...S.zones.map((z) => [z.id, fmt(ta.nomesZona, { zona: z.name })] as [string, string])]}
          onCanvi={(v) => setAState({ zona: v })}
        />
        <Casella etiqueta={ta.respecta} valor={aState.respecta} onCanvi={(v) => setAState({ respecta: v })} />
        <div className="st-grid2" style={{ marginTop: 9 }}>
          <button
            className="st-btn st-primary"
            disabled={!aState.el}
            onClick={() => {
              const el = aState.el;
              if (!el) return;
              let r: ReturnType<typeof autoAssign> = { n: 0 };
              muta((S) => {
                r = autoAssign(S, { ...aState, el });
              });
              avisa("error" in r ? (r.error === "ningu" ? ta.ningu : ta.senseSeients) : fmt(ta.colocades, { n: r.n }));
            }}
          >
            {ta.assigna}
          </button>
          <button
            className="st-btn st-danger"
            disabled={!aState.el}
            onClick={() => {
              muta((S) => S.els.find((e) => e.id === aState.el)?.seats.forEach((s) => unassignSeat(S, s)));
              avisa(ta.buidat);
            }}
          >
            {ta.buida}
          </button>
        </div>
        <div style={{ marginTop: 9 }}>
          <Casella etiqueta={ta.mostraOrdre} valor={showOrder} onCanvi={setShowOrder} />
          <Casella etiqueta={ta.mostraNoms} valor={showNames} onCanvi={setShowNames} />
        </div>
      </div>
    </>
  );
}

// ====================================================================
// Acte (control d'accés)
// ====================================================================
export function PanellActe({
  S,
  t,
  arribats,
  esSuper,
  marca,
  onTria,
  showNames,
  setShowNames,
}: Comu & {
  arribats: Set<string>;
  esSuper: boolean;
  marca: (ids: string[], valor: boolean) => void;
  onTria: (id: string) => void;
  showNames: boolean;
  setShowNames: (v: boolean) => void;
}) {
  const tc = t.acte;
  const [q, setQ] = useState("");
  const seated = orderedPeople(S).filter((p) => p.seat);
  const ql = q.toLowerCase();
  const shown = seated.filter((p) => !ql || p.name.toLowerCase().includes(ql) || (p.org || "").toLowerCase().includes(ql));
  const n = seated.filter((p) => arribats.has(p.id)).length;

  return (
    <>
      <div className="st-sec">
        <h3>{tc.control}</h3>
        <input type="search" placeholder={tc.cerca} aria-label={tc.cerca} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
        <div className="st-hint" style={{ marginBottom: 8 }}>{fmt(tc.resum, { a: n, n: seated.length })}</div>
        {shown.length ? (
          <div className="st-list">
            {shown.map((p) => {
              const dins = arribats.has(p.id);
              return (
                <button
                  key={p.id}
                  className={`st-row ${dins ? "in" : ""}`}
                  aria-pressed={dins}
                  onClick={() => {
                    marca([p.id], !dins);
                    onTria(p.id);
                  }}
                >
                  <span className="st-nm">
                    {dins ? "✓ " : ""}
                    {p.name}
                    {p.org && <span className="st-sub st-block">{p.org}</span>}
                  </span>
                  <span className="st-seat">{seatLabelOf(S, p) || "—"}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="st-empty">{tc.cap}</div>
        )}
        {esSuper && (
          <div className="st-grid2" style={{ marginTop: 9 }}>
            <button className="st-btn" onClick={() => marca(seated.map((p) => p.id), true)}>{tc.marcaTothom}</button>
            <button
              className="st-btn"
              onClick={() => {
                if (confirm(tc.confirmaReinicia)) marca(S.people.map((p) => p.id), false);
              }}
            >
              {tc.reinicia}
            </button>
          </div>
        )}
      </div>
      <div className="st-sec">
        <h3>{t.muntatge.vista}</h3>
        <Casella etiqueta={t.assignacio.mostraNoms} valor={showNames} onCanvi={setShowNames} />
      </div>
    </>
  );
}

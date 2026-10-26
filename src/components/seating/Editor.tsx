"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Download, Menu, Undo2, Upload } from "lucide-react";
import type { Diccionari } from "@/i18n/ca";
import { fmt } from "@/i18n/format";
import { llegeixPlanol, type TipusElement, type Zona } from "@/lib/seating/model.ts";
import {
  assign,
  comptes,
  eliminaElement,
  makeEl,
  orderedPeople,
  posicioSeient,
  rebuild,
  unassignSeat,
  worldBox,
} from "@/lib/seating/geometria.ts";
import { seatOrder, type OpcionsAuto } from "@/lib/seating/protocol.ts";
import { carregaPlanol, desaPlanol, llegeixArribades, marcaArribades } from "@/lib/accions-seating";
import { Magatzem } from "./magatzem";
import { Plano } from "./Plano";
import { ControlVista } from "./vista";
import { PanellActe, PanellAssignacio, PanellMuntatge, type Muta } from "./Panells";
import { DialegExporta, DialegImporta, DialegPersona } from "./Dialegs";
import { exportaJSON } from "./exporta";
import "./seating.css";

export type Mode = "muntatge" | "assig" | "acte";
type EstatDesat = "desat" | "pendent" | "desant" | "conflicte" | "error";
const CAP = new Set<string>();

// Editor del plànol. El document viu en un Magatzem (fora de React) i només
// es modifica amb muta(), que també apunta l'estat anterior per desfer i
// programa el desat. Les arribades van a part (taula `arribades`).
export function Editor({
  planolId,
  esdevenimentId,
  inicial,
  versioInicial,
  arribadesInicials,
  esSuper,
  t,
  locale,
  zonesPerDefecte,
}: {
  planolId: string;
  esdevenimentId: string;
  inicial: unknown;
  versioInicial: number;
  arribadesInicials: string[];
  esSuper: boolean;
  t: Diccionari["seating"];
  locale: string;
  zonesPerDefecte: Zona[];
}) {
  const [m] = useState(
    () => new Magatzem(llegeixPlanol(inicial, zonesPerDefecte) ?? llegeixPlanol({ els: [], people: [] }, zonesPerDefecte)!),
  );
  const tick = useSyncExternalStore(m.subscriu, m.llegeix, m.llegeix);
  const doc = m.S;

  const [mode, setMode] = useState<Mode>(esSuper ? "muntatge" : "acte");
  const [sel, setSel] = useState<string | null>(null);
  const [selPerson, setSelPerson] = useState<string | null>(null);
  const [brush, setBrush] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [snap, setSnap] = useState(true);
  const [sideOn, setSideOn] = useState(false);
  const [dialeg, setDialeg] = useState<null | "persona" | "csv" | "exporta">(null);
  const [aState, setAState] = useState<Omit<OpcionsAuto, "el"> & { el: string | null }>({
    el: null,
    ordre: "alternada",
    qui: "free",
    parell: "right",
    zona: "",
    respecta: true,
  });
  const [arribats, setArribats] = useState(() => new Set(arribadesInicials));
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [vista] = useState(() => new ControlVista(setZoom));
  const fitxerJson = useRef<HTMLInputElement>(null);

  const avisa = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // ------------------------------------------------------------------
  // Desat automàtic, amb control de versió
  // ------------------------------------------------------------------
  const versio = useRef(versioInicial);
  const [estat, setEstat] = useState<EstatDesat>("desat");
  const [errorDesar, setErrorDesar] = useState("");
  const [reintents, setReintents] = useState(0);
  const brut = useRef(false);
  const desant = useRef(false);
  const conflicte = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const desa = useCallback(async (): Promise<void> => {
    if (!esSuper || desant.current || !brut.current || conflicte.current) return;
    desant.current = true;
    brut.current = false;
    setEstat("desant");
    const r = await desaPlanol(planolId, m.S, versio.current);
    desant.current = false;
    if ("versio" in r) {
      versio.current = r.versio;
      if (brut.current) {
        // Hi ha hagut canvis mentre desàvem: una altra volta (efecte de sota).
        setEstat("pendent");
        setReintents((n) => n + 1);
      } else setEstat("desat");
    } else if ("conflicte" in r) {
      brut.current = true;
      conflicte.current = true;
      setEstat("conflicte");
    } else {
      brut.current = true;
      setErrorDesar(r.error);
      setEstat("error");
    }
  }, [esSuper, m, planolId]);
  useEffect(() => {
    if (!reintents) return;
    const id = setTimeout(() => void desa(), 400);
    return () => clearTimeout(id);
  }, [reintents, desa]);

  const programaDesat = useCallback(() => {
    if (!esSuper) return;
    brut.current = true;
    if (!conflicte.current) setEstat("pendent");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void desa(), 1500);
  }, [desa, esSuper]);

  // Desfer: l'estat anterior a cada canvi, com a text (com l'original).
  const hist = useRef<string[]>([]);
  const muta: Muta = useCallback(
    (f, opcions) => {
      if (!esSuper) return;
      if (opcions?.historial !== false) {
        hist.current.push(JSON.stringify(m.S));
        if (hist.current.length > 60) hist.current.shift();
      }
      m.muta(f);
      programaDesat();
    },
    [esSuper, m, programaDesat],
  );

  const desfes = useCallback(() => {
    const prev = hist.current.pop();
    if (!prev) return;
    m.substitueix(JSON.parse(prev));
    setSel(null);
    setSelPerson(null);
    programaDesat();
  }, [m, programaDesat]);

  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => {
      if (brut.current || desant.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, []);

  const recarrega = async () => {
    const r = await carregaPlanol(planolId);
    const nou = r && llegeixPlanol(r.dades, zonesPerDefecte);
    if (!r || !nou) return;
    m.substitueix(nou);
    versio.current = r.versio;
    brut.current = false;
    conflicte.current = false;
    hist.current = [];
    setSel(null);
    setSelPerson(null);
    setEstat("desat");
  };

  // ------------------------------------------------------------------
  // Vista
  // ------------------------------------------------------------------
  const fit = useCallback(() => vista.ajusta(worldBox(m.S)), [m, vista]);
  useEffect(() => {
    fit();
  }, [fit]);
  const centraPersona = (pid: string) => {
    const p = m.S.people.find((x) => x.id === pid);
    if (!p?.seat) return;
    const el = m.S.els.find((x) => x.id === p.seat!.el);
    const pos = el && posicioSeient(el, p.seat.i);
    if (pos) vista.centra(pos.x, pos.y);
  };

  // ------------------------------------------------------------------
  // Arribades: en mode acte es tornen a llegir cada 10 s (hi ha més gent
  // marcant a la porta).
  // ------------------------------------------------------------------
  useEffect(() => {
    if (mode !== "acte") return;
    let viu = true;
    const llegeix = async () => {
      if (document.visibilityState !== "visible") return;
      const ids = await llegeixArribades(planolId);
      if (viu) setArribats(new Set(ids));
    };
    void llegeix();
    const id = setInterval(llegeix, 10000);
    return () => {
      viu = false;
      clearInterval(id);
    };
  }, [mode, planolId]);

  const marca = async (ids: string[], valor: boolean) => {
    const abans = arribats;
    const nou = new Set(arribats);
    ids.forEach((id) => (valor ? nou.add(id) : nou.delete(id)));
    setArribats(nou);
    const r = await marcaArribades(planolId, ids, valor);
    if (r.error) {
      setArribats(abans);
      avisa(r.error);
    }
  };

  // ------------------------------------------------------------------
  // Clic a un seient
  // ------------------------------------------------------------------
  const onSeat = (eid: string, i: number) => {
    const el = m.S.els.find((x) => x.id === eid);
    const s = el?.seats[i];
    if (!el || !s) return;

    if (mode === "muntatge") {
      if (!brush) return; // sense pinzell, el clic serveix per moure l'element
      muta((S) => {
        if (brush === "block") {
          s.blocked = !s.blocked;
          if (s.blocked) unassignSeat(S, s);
        } else s.tag = s.tag === brush ? null : brush;
      });
      return;
    }
    if (mode === "assig") {
      if (s.person && !selPerson) return muta((S) => unassignSeat(S, s));
      if (!selPerson) return avisa(t.assignacio.triaPersona);
      if (s.blocked) return avisa(t.assignacio.bloquejat);
      muta((S) => assign(S, selPerson, el, s));
      const lliures = orderedPeople(m.S).filter((p) => !p.seat);
      setSelPerson(lliures.length ? lliures[0].id : null);
      return;
    }
    if (!s.person) return avisa(t.acte.seientLliure);
    void marca([s.person], !arribats.has(s.person));
  };

  // ------------------------------------------------------------------
  // Ordre de protocol visible
  // ------------------------------------------------------------------
  const elementsAmbSeients = doc.els.filter((e) => e.seats.length);
  const elAuto =
    aState.el && elementsAmbSeients.some((e) => e.id === aState.el)
      ? aState.el
      : ((elementsAmbSeients.find((e) => e.id === sel) ?? elementsAmbSeients[0])?.id ?? null);
  const ordre = useMemo(() => {
    if (!showOrder || mode !== "assig") return null;
    const el = m.S.els.find((e) => e.id === elAuto);
    if (!el) return null;
    const n = new Map<number, number>();
    seatOrder(el, aState.ordre, aState.parell).forEach((si, k) => n.set(si, k + 1));
    return { el: el.id, n, tick };
  }, [showOrder, mode, elAuto, aState.ordre, aState.parell, tick, m]);

  // ------------------------------------------------------------------
  // Teclat
  // ------------------------------------------------------------------
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement | null)?.tagName ?? "")) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && esSuper) {
        e.preventDefault();
        desfes();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "s" && esSuper) {
        e.preventDefault();
        clearTimeout(timer.current);
        void desa();
      } else if (e.key === "Delete" && sel && mode === "muntatge") {
        muta((S) => eliminaElement(S, sel));
        setSel(null);
      } else if (e.key === "Escape") {
        setDialeg(null);
        setBrush(null);
        setSelPerson(null);
      }
    };
    document.addEventListener("keydown", f);
    return () => document.removeEventListener("keydown", f);
  }, [desa, desfes, esSuper, mode, muta, sel]);

  const canviaMode = (nou: Mode) => {
    setMode(nou);
    setBrush(null);
    setSelPerson(null);
    if (nou !== "muntatge" && !sel) setSel(elementsAmbSeients[0]?.id ?? null);
  };

  // Importa un plànol .json de l'eina antiga o una còpia.
  const importaJson = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const o = llegeixPlanol(JSON.parse(String(r.result)), zonesPerDefecte);
        if (!o) throw new Error();
        if (!confirm(t.dialegs.substitueix)) return;
        muta((S) => Object.assign(S, o));
        setSel(null);
        setSelPerson(null);
        setTimeout(fit, 0);
        avisa(t.dialegs.jsonImportat);
      } catch {
        avisa(t.dialegs.jsonInvalid);
      }
    };
    r.readAsText(f, "utf-8");
  };

  const afegeixElement = (tipus: TipusElement) => {
    const centre = vista.centreMon();
    let id = "";
    muta((S) => {
      const el = makeEl(S, tipus, t.noms);
      el.x = centre.x;
      el.y = centre.y;
      S.els.push(el);
      id = el.id;
    });
    setSel(id);
  };

  const c = comptes(doc, arribats);
  const zonesUsades = new Set<string>();
  doc.els.forEach((e) => e.seats.forEach((s) => s.tag && zonesUsades.add(s.tag)));
  const comu = { S: doc, t, muta, avisa };

  return (
    <div className={`seating ${sideOn ? "side-on" : ""}`}>
      <header className="st-bar">
        <button className="st-btn st-sidetoggle" onClick={() => setSideOn((x) => !x)} title={t.barra.panell} aria-label={t.barra.panell}>
          <Menu size={16} aria-hidden />
        </button>
        <Link href={`/e/${esdevenimentId}/planols`} className="st-btn st-ghost" title={t.barra.tornar}>
          <ArrowLeft size={15} aria-hidden /> <span className="st-amaga-mobil">{t.barra.tornar}</span>
        </Link>
        <input
          className="st-titlefield"
          value={doc.meta.title}
          readOnly={!esSuper}
          aria-label={t.llista.nom}
          onChange={(e) => {
            const v = e.target.value;
            muta((S) => (S.meta.title = v), { historial: false });
          }}
        />
        <div className="st-modes" role="group">
          {(esSuper ? (["muntatge", "assig", "acte"] as const) : (["acte"] as const)).map((md) => (
            <button key={md} aria-pressed={mode === md} onClick={() => canviaMode(md)}>
              {md === "assig" ? t.modes.assignacio : t.modes[md]}
            </button>
          ))}
        </div>
        <span className="st-spacer" />
        {esSuper ? (
          <span className={`st-flag st-flag-${estat}`} role="status">
            {estat === "error" ? fmt(t.desat.error, { error: errorDesar }) : estat === "conflicte" ? "" : t.desat[estat]}
          </span>
        ) : (
          <span className="st-flag">{t.barra.nomesLectura}</span>
        )}
        {esSuper && (
          <>
            <button className="st-btn" onClick={desfes} title={t.barra.desfes} aria-label={t.barra.desfes}>
              <Undo2 size={15} aria-hidden />
            </button>
            <button className="st-btn" onClick={() => fitxerJson.current?.click()} title={t.barra.importa} aria-label={t.barra.importa}>
              <Upload size={15} aria-hidden />
            </button>
          </>
        )}
        <button className="st-btn st-primary" onClick={() => setDialeg("exporta")} title={t.barra.exporta}>
          <Download size={15} aria-hidden /> <span className="st-amaga-mobil">{t.barra.exporta}</span>
        </button>
      </header>

      {estat === "conflicte" && (
        <div className="st-conflicte" role="alert">
          <span>{t.desat.conflicte}</span>
          <button className="st-btn" onClick={() => exportaJSON(m.S)}>{t.desat.baixaCopia}</button>
          <button className="st-btn st-primary" onClick={recarrega}>{t.desat.recarrega}</button>
        </div>
      )}

      <div className="st-wrap">
        {/* Al mòbil el panell tapa la barra: tocar fora el tanca. */}
        <div className="st-tel" onClick={() => setSideOn(false)} aria-hidden />
        <aside className="st-side">
          <div className="st-sidebody">
            <div className="st-stats">
              <div className="st-stat"><b>{c.total}</b><span>{t.stats.seients}</span></div>
              <div className="st-stat"><b>{c.taken}</b><span>{t.stats.assignats}</span></div>
              <div className="st-stat"><b>{c.free}</b><span>{t.stats.lliures}</span></div>
              {mode === "acte" ? (
                <div className="st-stat"><b>{c.arrived}</b><span>{t.stats.arribats}</span></div>
              ) : (
                <div className="st-stat"><b>{c.blocked}</b><span>{t.stats.blocats}</span></div>
              )}
            </div>
            {mode === "muntatge" && esSuper && (
              <PanellMuntatge
                {...comu}
                sel={sel}
                setSel={setSel}
                brush={brush}
                setBrush={setBrush}
                snap={snap}
                setSnap={setSnap}
                afegeix={afegeixElement}
                centra={(x, y) => vista.centra(x, y)}
                rebuild={(S, el) => {
                  const perduts = rebuild(S, el);
                  if (perduts) avisa(fmt(t.muntatge.perduts, { n: perduts }));
                }}
              />
            )}
            {mode === "assig" && esSuper && (
              <PanellAssignacio
                {...comu}
                selPerson={selPerson}
                setSelPerson={(id) => {
                  setSelPerson(id);
                  if (id) centraPersona(id);
                }}
                aState={{ ...aState, el: elAuto }}
                setAState={(canvis) => {
                  setAState((a) => ({ ...a, ...canvis }));
                  if (canvis.el) setSel(canvis.el);
                }}
                showOrder={showOrder}
                setShowOrder={setShowOrder}
                showNames={showNames}
                setShowNames={setShowNames}
                obreDialeg={setDialeg}
              />
            )}
            {mode === "acte" && (
              <PanellActe
                {...comu}
                arribats={arribats}
                esSuper={esSuper}
                marca={(ids, v) => void marca(ids, v)}
                onTria={(id) => {
                  setSelPerson(id);
                  centraPersona(id);
                }}
                showNames={showNames}
                setShowNames={setShowNames}
              />
            )}
          </div>
        </aside>
        <main className="st-stage">
          <Plano
            S={doc}
            versio={tick}
            mode={mode}
            sel={mode === "muntatge" ? sel : null}
            selPerson={selPerson}
            brush={brush}
            showNames={showNames}
            ordre={ordre}
            arribats={mode === "acte" ? arribats : CAP}
            snap={snap}
            vista={vista}
            onSeat={onSeat}
            onSelEl={(id) => {
              setSel(id);
              if (id) setSideOn(true);
            }}
            onMou={(id, x, y) =>
              muta((S) => {
                const el = S.els.find((e) => e.id === id);
                if (el) {
                  el.x = x;
                  el.y = y;
                }
              })
            }
          />
          <div className="st-hud">
            <button className="st-btn" onClick={() => vista.zoomCentre(1 / 1.2)} aria-label={t.barra.allunya}>−</button>
            <span className="st-zoomlvl">{Math.round(zoom * 100)}%</span>
            <button className="st-btn" onClick={() => vista.zoomCentre(1.2)} aria-label={t.barra.apropa}>+</button>
            <button className="st-btn" onClick={fit}>{t.barra.ajusta}</button>
          </div>
          <div className="st-legend">
            <div><i style={{ background: "#fff", borderColor: "#8C8474" }} /> {t.llegenda.lliure}</div>
            <div><i style={{ background: "#2F3A46" }} /> {t.llegenda.assignat}</div>
            <div><i style={{ background: "#DCD7CB" }} /> {t.llegenda.bloquejat}</div>
            {mode === "acte" && (
              <div><i style={{ background: "#fff", border: "2px solid #1F7A4C" }} /> {t.llegenda.arribat}</div>
            )}
            {doc.zones
              .filter((z) => zonesUsades.has(z.id))
              .map((z) => (
                <div key={z.id}><i style={{ background: z.color }} /> {z.name}</div>
              ))}
          </div>
          {toast && <div className="st-toast" role="status">{toast}</div>}
        </main>
      </div>

      {dialeg === "persona" && <DialegPersona {...comu} tanca={() => setDialeg(null)} />}
      {dialeg === "csv" && <DialegImporta {...comu} tanca={() => setDialeg(null)} />}
      {dialeg === "exporta" && (
        <DialegExporta S={doc} t={t} locale={locale} arribats={arribats} vista={vista} avisa={avisa} tanca={() => setDialeg(null)} />
      )}
      <input
        ref={fitxerJson}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importaJson(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

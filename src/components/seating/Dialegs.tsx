"use client";

import { useRef, useState } from "react";
import type { Diccionari } from "@/i18n/ca";
import { fmt } from "@/i18n/format";
import type { Planol } from "@/lib/seating/model.ts";
import { uid } from "@/lib/seating/model.ts";
import { parseCSV } from "@/lib/seating/csv.ts";
import type { Muta } from "./Panells";
import type { ControlVista } from "./vista";
import { exportaCSV, exportaJSON, exportaPNG, imprimeixEtiquetes, imprimeixLlista, imprimeixPlanol } from "./exporta";

type T = Diccionari["seating"];

function Modal({ titol, children, tanca }: { titol: string; children: React.ReactNode; tanca: () => void }) {
  return (
    <div className="st-modal" onPointerDown={(e) => e.target === e.currentTarget && tanca()}>
      <div className="st-card" role="dialog" aria-modal="true" aria-label={titol}>
        <h2>{titol}</h2>
        {children}
      </div>
    </div>
  );
}

export function DialegPersona({ t, muta, tanca }: { t: T; muta: Muta; tanca: () => void }) {
  const d = t.dialegs;
  const [f, setF] = useState({ name: "", role: "", org: "", group: "" });
  const camp = (k: keyof typeof f, etiqueta: string, autoFocus = false) => (
    <div className="st-field">
      <label>
        {etiqueta}
        <input autoFocus={autoFocus} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      </label>
    </div>
  );
  return (
    <Modal titol={d.afegeixTitol} tanca={tanca}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = f.name.trim();
          if (!name) return;
          muta((S) =>
            S.people.push({
              id: uid(S, "p"),
              name,
              role: f.role.trim(),
              org: f.org.trim(),
              group: f.group.trim(),
              rank: S.people.length + 1,
              seat: null,
            }),
          );
          tanca();
        }}
      >
        <div className="st-hint">{d.afegeixAjuda}</div>
        {camp("name", d.nomCognoms, true)}
        <div className="st-grid2">
          {camp("role", d.carrec)}
          {camp("org", d.entitat)}
        </div>
        {camp("group", d.grup)}
        <div className="st-mrow">
          <button type="button" className="st-btn" onClick={tanca}>{d.cancella}</button>
          <button className="st-btn st-primary">{d.afegeix}</button>
        </div>
      </form>
    </Modal>
  );
}

export function DialegImporta({ t, muta, avisa, tanca }: { t: T; muta: Muta; avisa: (m: string) => void; tanca: () => void }) {
  const d = t.dialegs;
  const [text, setText] = useState("");
  const fitxer = useRef<HTMLInputElement>(null);
  return (
    <Modal titol={d.importaTitol} tanca={tanca}>
      <div className="st-hint">{d.importaAjuda}</div>
      <textarea rows={9} value={text} placeholder={d.importaExemple} aria-label={d.importaTitol} onChange={(e) => setText(e.target.value)} />
      <div className="st-mrow">
        <button className="st-btn" onClick={() => fitxer.current?.click()}>{d.carregaFitxer}</button>
        <button className="st-btn" onClick={tanca}>{d.cancella}</button>
        <button
          className="st-btn st-primary"
          onClick={() => {
            let n = 0;
            muta((S) => {
              n = parseCSV(S, text);
            });
            tanca();
            avisa(n ? fmt(d.importats, { n }) : d.capNom);
          }}
        >
          {d.importa}
        </button>
      </div>
      <input
        ref={fitxer}
        type="file"
        accept=".csv,.txt,text/csv"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = () => setText(String(r.result));
          r.readAsText(f, "utf-8");
          e.target.value = "";
        }}
      />
    </Modal>
  );
}

export function DialegExporta({
  S,
  t,
  locale,
  arribats,
  vista,
  avisa,
  tanca,
}: {
  S: Planol;
  t: T;
  locale: string;
  arribats: Set<string>;
  vista: ControlVista;
  avisa: (m: string) => void;
  tanca: () => void;
}) {
  const x = t.exporta;
  const fes = (f: () => void) => () => {
    tanca();
    f();
  };
  return (
    <Modal titol={t.barra.exporta} tanca={tanca}>
      <div className="st-hint">{x.ajuda}</div>
      <div className="st-stack">
        <button className="st-btn" onClick={fes(() => vista.svg && exportaPNG(vista.svg, S, t, avisa))}>{x.png}</button>
        <button className="st-btn" onClick={fes(() => vista.svg && imprimeixPlanol(vista.svg, S, t, locale))}>{x.imprimeix}</button>
        <button className="st-btn" onClick={fes(() => imprimeixEtiquetes(S, t, avisa))}>{x.etiquetes}</button>
        <button className="st-btn" onClick={fes(() => imprimeixLlista(S, t, locale, avisa))}>{x.llista}</button>
        <button className="st-btn" onClick={fes(() => exportaCSV(S, arribats, t))}>{x.csv}</button>
        <button className="st-btn" onClick={fes(() => exportaJSON(S))}>{x.json}</button>
      </div>
      <div className="st-mrow">
        <button className="st-btn" onClick={tanca}>{x.tanca}</button>
      </div>
    </Modal>
  );
}

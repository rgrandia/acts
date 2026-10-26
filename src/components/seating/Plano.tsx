"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ControlVista } from "./vista";
import type { Element, Planol, Seient, Zona } from "@/lib/seating/model.ts";
import { SEAT, bbox, geom, short } from "@/lib/seating/geometria.ts";

// Dibuix del plànol en SVG i interacció (moure elements, desplaçar, zoom amb
// roda i amb dos dits). Portat de seating.html.
//
// La vista (desplaçament i zoom) viu en un ref i s'aplica directament al DOM:
// moure el plànol no ha de tornar a dibuixar centenars de seients.


const MONO = `ui-monospace,'SF Mono',Menlo,Consolas,monospace`;
const SVGCSS = `
  .paper{fill:#FAF7F0}
  .elbody{fill:#EFE9DB;stroke:#B9B1A0;stroke-width:1.2}
  .elstage{fill:#2B303A;stroke:#12151A}
  .eloutline{fill:none;stroke:#B9B1A0;stroke-width:1;stroke-dasharray:3 4}
  .elname{font-family:${MONO};font-size:10px;fill:#7A7365;letter-spacing:.08em;text-transform:uppercase}
  .stagetxt{font-family:${MONO};font-size:11px;fill:#FAF7F0;letter-spacing:.18em;text-transform:uppercase}
  .seat.blocked rect{stroke-dasharray:2 2}
  .seat text{font-family:${MONO};text-anchor:middle;dominant-baseline:central;pointer-events:none}
  .seat.taken text{font-weight:600}
  .selrect{fill:none;stroke:#14171C;stroke-width:1.5;stroke-dasharray:5 3}
  .ord{font-family:${MONO};font-size:9px;fill:#A81D2D;font-weight:700;text-anchor:middle}
`;

const PAPER = "#FAF7F0";
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hx = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
export const mix = (a: string, b: string, t: number) => {
  const A = rgb(a), B = rgb(b);
  return "#" + A.map((v, i) => hx(v * (1 - t) + B[i] * t)).join("");
};
function lum(h: string) {
  const [r, g, b] = rgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Un únic lloc decideix el color del seient. Prioritat: selecció > arribada > zona.
function seatStyle(s: Seient, z: Zona | undefined, ocupat: boolean, arribat: boolean, seleccionat: boolean) {
  let fill = "#FFFFFF", stroke = "#8C8474", sw = 1.1;
  if (s.blocked) {
    fill = "#DCD7CB";
    stroke = "#B0A897";
  } else if (ocupat) {
    fill = z ? z.color : "#2F3A46";
    stroke = z ? mix(z.color, "#000000", 0.3) : "#0E1116";
    sw = 1.4;
  } else if (z) {
    fill = mix(z.color, PAPER, 0.84);
    stroke = z.color;
    sw = 1.3;
  }
  if (ocupat && arribat) {
    stroke = "#1F7A4C";
    sw = 2.4;
  }
  if (seleccionat) {
    stroke = "#C08400";
    sw = 3;
  }
  return { fill, stroke, sw, txt: lum(fill) < 0.42 ? "#FFFFFF" : "#4A4438" };
}

type Props = {
  S: Planol;
  versio: number; // canvia quan canvien les dades (S es modifica in situ)
  mode: "muntatge" | "assig" | "acte";
  sel: string | null;
  selPerson: string | null;
  brush: string | null;
  showNames: boolean;
  ordre: { el: string; n: Map<number, number> } | null;
  arribats: Set<string>;
  snap: boolean;
  vista: ControlVista;
  onSeat: (el: string, i: number) => void;
  onSelEl: (id: string | null) => void;
  onMou: (el: string, x: number, y: number) => void; // en acabar d'arrossegar
};

export function Plano(p: Props) {
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<
    | null
    | { pan: true; sx: number; sy: number; vx: number; vy: number }
    | { pan?: false; el: string; rot: number; ox: number; oy: number; dx: number; dy: number; x: number; y: number; moved: boolean }
  >(null);
  const pinch = useRef<null | { d: number; k: number; cx: number; cy: number; vx: number; vy: number }>(null);
  const { vista } = p;
  const registra = useCallback((svg: SVGSVGElement | null) => vista.registra(svg), [vista]);

  // Després de cada dibuix, torna a posar la vista (el transform no és a l'estat).
  useLayoutEffect(() => {
    vista.aplica();
  });

  // Roda del ratolí: cal un listener no passiu per poder fer preventDefault.
  useEffect(() => {
    const svg = vista.svg;
    if (!svg) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      vista.zoomA(vista.k * (e.deltaY < 0 ? 1.12 : 0.89), e.clientX - r.left, e.clientY - r.top);
    };
    svg.addEventListener("wheel", roda, { passive: false });
    return () => svg.removeEventListener("wheel", roda);
  }, [vista]);

  const down = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    svg.setPointerCapture(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), k: vista.k, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: vista.x, vy: vista.y };
      drag.current = null;
      return;
    }
    const target = e.target as globalThis.Element;
    const seatEl = target.closest("[data-seat]") as HTMLElement | null;
    const elNode = target.closest("[data-el]") as HTMLElement | null;

    if (seatEl) {
      const [eid, i] = seatEl.dataset.seat!.split(":");
      p.onSeat(eid, +i);
      if (p.mode !== "muntatge") return;
    }
    if (elNode && p.mode === "muntatge") {
      const el = p.S.els.find((x) => x.id === elNode.dataset.el);
      if (el && !p.brush) {
        p.onSelEl(el.id);
        const w = vista.aMon(e.clientX, e.clientY);
        drag.current = { el: el.id, rot: el.rot, ox: el.x, oy: el.y, dx: w.x - el.x, dy: w.y - el.y, x: el.x, y: el.y, moved: false };
        return;
      }
      if (el && p.brush) {
        p.onSelEl(el.id);
        return;
      }
    }
    if (!elNode && p.mode === "muntatge" && p.sel) p.onSelEl(null);
    drag.current = { pan: true, sx: e.clientX, sy: e.clientY, vx: vista.x, vy: vista.y };
    svg.classList.add("panning");
  };

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pc = pinch.current;
    if (pc && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = e.currentTarget.getBoundingClientRect();
      // El punt del mig dels dits es queda on era.
      const wx = (pc.cx - r.left - pc.vx) / pc.k, wy = (pc.cy - r.top - pc.vy) / pc.k;
      const k = Math.max(0.1, Math.min(4, (pc.k * d) / pc.d));
      vista.posa(pc.cx - r.left - wx * k, pc.cy - r.top - wy * k, k);
      return;
    }
    const dr = drag.current;
    if (!dr) return;
    if (dr.pan) {
      vista.posa(dr.vx + (e.clientX - dr.sx), dr.vy + (e.clientY - dr.sy));
      return;
    }
    const w = vista.aMon(e.clientX, e.clientY);
    let nx = w.x - dr.dx, ny = w.y - dr.dy;
    if (p.snap) {
      nx = Math.round(nx / 10) * 10;
      ny = Math.round(ny / 10) * 10;
    }
    // Mentre s'arrossega només es mou el dibuix; el document canvia en deixar-lo anar.
    dr.moved = dr.moved || nx !== dr.ox || ny !== dr.oy;
    dr.x = nx;
    dr.y = ny;
    e.currentTarget.querySelector(`[data-el="${dr.el}"]`)?.setAttribute("transform", `translate(${nx},${ny}) rotate(${dr.rot})`);
  };

  const up = (e: React.PointerEvent<SVGSVGElement>) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    const dr = drag.current;
    if (dr && !dr.pan && dr.moved) p.onMou(dr.el, dr.x, dr.y);
    drag.current = null;
    e.currentTarget.classList.remove("panning");
  };

  return (
    <svg
      ref={registra}
      className="st-plan"
      xmlns="http://www.w3.org/2000/svg"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <defs>
        <style>{SVGCSS}</style>
        <pattern id="st-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#E6E1D4" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="-100000" y="-100000" width="200000" height="200000" className="paper" />
      <g data-world="">
        <rect x="-4000" y="-3000" width="8000" height="6000" fill="url(#st-grid)" />
        {p.S.els.map((el) => (
          <ElementSvg
            key={el.id}
            el={el}
            versio={p.versio}
            zones={p.S.zones}
            people={p.S.people}
            seleccionat={el.id === p.sel}
            selPerson={p.selPerson}
            showNames={p.showNames}
            ordre={p.ordre && p.ordre.el === el.id ? p.ordre.n : null}
            arribats={p.arribats}
          />
        ))}
      </g>
    </svg>
  );
}

// Un element amb els seus seients. Memoritzat: en un plànol gran, canviar la
// selecció d'un element no ha de redibuixar tots els altres.
const ElementSvg = memo(function ElementSvg({
  el,
  zones,
  people,
  seleccionat,
  selPerson,
  showNames,
  ordre,
  arribats,
}: {
  el: Element;
  versio: number;
  zones: Zona[];
  people: Planol["people"];
  seleccionat: boolean;
  selPerson: string | null;
  showNames: boolean;
  ordre: Map<number, number> | null;
  arribats: Set<string>;
}) {
  const gs = geom(el);
  const zona = (id: string | null) => (id ? zones.find((z) => z.id === id) : undefined);
  let cos: React.ReactNode = null;
  if (el.type === "round") cos = <circle r={el.p.r} className="elbody" />;
  if (el.type === "rect")
    cos = <rect x={-el.p.w / 2} y={-el.p.h / 2} width={el.p.w} height={el.p.h} rx={4} className="elbody" />;
  if (el.type === "head") {
    const w = Math.max(el.p.n * el.p.pitch, 80);
    cos = <rect x={-w / 2} y={20} width={w} height={26} rx={3} className="elbody" />;
  }
  if (el.type === "shape") {
    const { w, h, kind } = el.p;
    cos = (
      <>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} className={kind === "escenari" ? "elstage" : "elbody"} />
        <text x={0} y={0} textAnchor="middle" dominantBaseline="central" className={kind === "escenari" ? "stagetxt" : "elname"}>
          {el.name || kind}
        </text>
      </>
    );
  }

  let etiqueta: React.ReactNode = null;
  if (el.type === "rows" && gs.length) {
    const xs = gs.map((s) => s.x), ys = gs.map((s) => s.y);
    const x0 = Math.min(...xs) - SEAT / 2 - 6, x1 = Math.max(...xs) + SEAT / 2 + 6;
    const y0 = Math.min(...ys) - SEAT / 2 - 6, y1 = Math.max(...ys) + SEAT / 2 + 6;
    etiqueta = (
      <>
        <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={4} className="eloutline" />
        <text x={x0} y={y0 - 6} className="elname">{el.name}</text>
      </>
    );
  } else if (el.type !== "shape") {
    const yy = el.type === "round" ? -el.p.r - SEAT - 14 : el.type === "rect" ? -el.p.h / 2 - SEAT - 14 : -SEAT - 12;
    etiqueta = <text x={0} y={yy} textAnchor="middle" className="elname">{el.name}</text>;
  }

  const b = seleccionat ? bbox(el) : null;
  return (
    <g data-el={el.id} transform={`translate(${el.x},${el.y}) rotate(${el.rot})`}>
      {cos}
      {etiqueta}
      {el.seats.map((s) => {
        const q = gs[s.i];
        if (!q) return null;
        const per = s.person ? people.find((x) => x.id === s.person) : undefined;
        const z = zona(s.tag);
        const arribat = !!per && arribats.has(per.id);
        const st = seatStyle(s, z, !!per, arribat, !!per && per.id === selPerson);
        const txt = String(per && showNames ? short(per.name) : s.label);
        const fs = txt.length <= 3 ? 8.5 : txt.length <= 5 ? 7.2 : txt.length <= 7 ? 6.2 : 5.4;
        const cls = ["seat", s.blocked && "blocked", per && "taken"].filter(Boolean).join(" ");
        const n = ordre?.get(s.i);
        return (
          <g key={s.i}>
            <g className={cls} data-seat={`${el.id}:${s.i}`} transform={`translate(${q.x},${q.y}) rotate(${q.rot || 0})`}>
              <title>
                {s.label}
                {per ? " — " + per.name : ""}
                {z ? " · " + z.name : ""}
              </title>
              <rect
                x={-SEAT / 2}
                y={-SEAT / 2}
                width={SEAT}
                height={SEAT}
                rx={4}
                style={{ fill: st.fill, stroke: st.stroke, strokeWidth: st.sw }}
              />
              <text style={{ fill: st.txt, fontSize: fs + "px" }}>{txt}</text>
            </g>
            {n && (
              <text className="ord" x={q.x} y={q.y - SEAT / 2 - 4}>
                {n}
              </text>
            )}
          </g>
        );
      })}
      {b && <rect className="selrect" x={b.x0 - 8} y={b.y0 - 8} width={b.x1 - b.x0 + 16} height={b.y1 - b.y0 + 16} rx={6} />}
    </g>
  );
});

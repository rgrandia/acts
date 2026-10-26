// Desplaçament i zoom del plànol. Viuen fora de l'estat de React: moure el
// plànol no ha de tornar a dibuixar centenars de seients. El component Plano
// hi registra l'<svg>; la resta (ajustar, centrar, exportar) en fa servir els mètodes.

import type { Caixa } from "@/lib/seating/geometria.ts";
import { clampN } from "@/lib/seating/geometria.ts";

export class ControlVista {
  x = 0;
  y = 0;
  k = 1;
  svg: SVGSVGElement | null = null;
  private onZoom: (k: number) => void;

  constructor(onZoom: (k: number) => void) {
    this.onZoom = onZoom;
  }

  registra = (svg: SVGSVGElement | null) => {
    this.svg = svg;
  };

  aplica() {
    this.svg?.querySelector("[data-world]")?.setAttribute("transform", `translate(${this.x},${this.y}) scale(${this.k})`);
    this.onZoom(this.k);
  }

  posa(x: number, y: number, k = this.k) {
    this.x = x;
    this.y = y;
    this.k = k;
    this.aplica();
  }

  rect(): DOMRect | null {
    return this.svg?.getBoundingClientRect() ?? null;
  }

  // Coordenades de pantalla -> plànol.
  aMon(cx: number, cy: number) {
    const r = this.rect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - this.x) / this.k, y: (cy - r.top - this.y) / this.k };
  }

  // Zoom mantenint fix el punt (px, py) relatiu a l'svg.
  zoomA(k: number, px: number, py: number) {
    const wx = (px - this.x) / this.k, wy = (py - this.y) / this.k;
    const nk = clampN(k, 0.1, 4);
    this.posa(px - wx * nk, py - wy * nk, nk);
  }

  zoomCentre(factor: number) {
    const r = this.rect();
    if (r) this.zoomA(this.k * factor, r.width / 2, r.height / 2);
  }

  ajusta(b: Caixa) {
    const r = this.rect();
    if (!r) return;
    const w = b.x1 - b.x0 + 120, h = b.y1 - b.y0 + 120;
    const k = clampN(Math.min(r.width / w, r.height / h), 0.12, 3);
    this.posa(r.width / 2 - ((b.x0 + b.x1) / 2) * k, r.height / 2 - ((b.y0 + b.y1) / 2) * k, k);
  }

  centra(x: number, y: number) {
    const r = this.rect();
    if (!r) return;
    const k = Math.max(this.k, 0.8);
    this.posa(r.width / 2 - x * k, r.height / 2 - y * k, k);
  }

  // Centre de la vista en coordenades del plànol, arrodonit a la quadrícula.
  centreMon() {
    const r = this.rect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.round((r.width / 2 - this.x) / this.k / 10) * 10,
      y: Math.round((r.height / 2 - this.y) / this.k / 10) * 10,
    };
  }
}

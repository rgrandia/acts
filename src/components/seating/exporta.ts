// Exportacions del plànol (PNG, impressió, etiquetes, llista de porta, CSV,
// JSON). Portades de seating.html. Treballen sobre el DOM del navegador.

import type { Diccionari } from "@/i18n/ca";
import { fmt } from "@/i18n/format";
import type { Planol } from "@/lib/seating/model.ts";
import { clampN, comptes, orderedPeople, seatLabelOf, worldBox } from "@/lib/seating/geometria.ts";

type T = Diccionari["seating"];

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function descarrega(nom: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const nomFitxer = (S: Planol, perDefecte: string, ext: string) =>
  ((S.meta.title || perDefecte) + "." + ext).replace(/[^\w\-.À-ÿ ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase();

function planSVG(svg: SVGSVGElement, S: Planol, pad = 40) {
  const b = worldBox(S);
  const w = Math.max(b.x1 - b.x0 + pad * 2, 200);
  const h = Math.max(b.y1 - b.y0 + pad * 2, 200);
  const s = svg.cloneNode(true) as SVGSVGElement;
  s.setAttribute("viewBox", `${b.x0 - pad} ${b.y0 - pad} ${w} ${h}`);
  s.setAttribute("width", String(w));
  s.setAttribute("height", String(h));
  s.removeAttribute("class");
  s.removeAttribute("style");
  s.querySelector("[data-world]")?.removeAttribute("transform");
  s.querySelectorAll(".selrect").forEach((n) => n.remove());
  return { node: s, w, h };
}

// Contenidor d'impressió: és l'únic que es veu en imprimir (globals.css).
function fullImpressio(html: string) {
  let div = document.getElementById("acts-print");
  if (!div) {
    div = document.createElement("div");
    div.id = "acts-print";
    document.body.appendChild(div);
  }
  div.innerHTML = html;
  setTimeout(() => window.print(), 60);
}

export function exportaPNG(svg: SVGSVGElement, S: Planol, t: T, avisa: (m: string) => void) {
  const { node, w, h } = planSVG(svg, S);
  const scale = clampN(1600 / Math.max(w, h), 1, 3);
  const xml = new XMLSerializer().serializeToString(node);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#FAF7F0";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => b && descarrega(nomFitxer(S, "planol", "png"), b));
  };
  img.onerror = () => avisa(t.exporta.errorImatge);
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
}

export function imprimeixPlanol(svg: SVGSVGElement, S: Planol, t: T, locale: string) {
  const { node } = planSVG(svg, S);
  node.style.width = "100%";
  node.style.height = "auto";
  node.removeAttribute("width");
  node.removeAttribute("height");
  const c = comptes(S, new Set());
  fullImpressio(`<div class="psheet">
      <div class="phead"><h1>${esc(S.meta.title || t.exporta.planolActe)}</h1>
      <span>${new Date().toLocaleDateString(locale)} · ${esc(fmt(t.exporta.ocupats, { a: c.taken, n: c.total }))}</span></div>
      ${node.outerHTML}</div>`);
}

export function imprimeixLlista(S: Planol, t: T, locale: string, avisa: (m: string) => void) {
  const list = [...S.people].sort((a, b) => a.name.localeCompare(b.name, locale));
  if (!list.length) return avisa(t.exporta.capConvidat);
  fullImpressio(`<div class="psheet">
    <div class="phead"><h1>${esc(S.meta.title || t.exporta.llistaConvidats)}</h1>
      <span>${esc(fmt(t.exporta.nConvidats, { n: list.length }))} · ${new Date().toLocaleDateString(locale)}</span></div>
    <table class="ptable"><thead><tr>
      <th class="b"></th><th>${esc(t.exporta.colNom)}</th><th>${esc(t.exporta.colCarrec)}</th><th>${esc(t.exporta.colSeient)}</th></tr></thead><tbody>
    ${list
      .map(
        (p) => `<tr>
      <td class="b"><span class="box"></span></td>
      <td>${esc(p.name)}</td>
      <td>${esc([p.role, p.org].filter(Boolean).join(" · "))}</td>
      <td class="s">${esc(seatLabelOf(S, p) || "—")}</td></tr>`,
      )
      .join("")}
    </tbody></table></div>`);
}

export function imprimeixEtiquetes(S: Planol, t: T, avisa: (m: string) => void) {
  const list = orderedPeople(S).filter((p) => p.seat);
  if (!list.length) return avisa(t.exporta.capSeient);
  fullImpressio(`<div class="psheet"><div class="cards">${list
    .map(
      (p) => `
    <div class="tag">
      <div class="ev">${esc(S.meta.title || "")}</div>
      <div class="nm">${esc(p.name)}</div>
      <div class="rl">${esc([p.role, p.org].filter(Boolean).join(" · "))}</div>
      <div class="st">${esc(seatLabelOf(S, p) || "")}</div>
    </div>`,
    )
    .join("")}</div></div>`);
}

export function exportaCSV(S: Planol, arribats: Set<string>, t: T) {
  const rows: (string | number)[][] = [t.exporta.capCsv.split(";")];
  orderedPeople(S).forEach((p) => {
    const e = p.seat ? S.els.find((x) => x.id === p.seat!.el) : null;
    rows.push([
      p.rank || "",
      p.name,
      p.role || "",
      p.org || "",
      p.group || "",
      e ? e.name : "",
      seatLabelOf(S, p) || "",
      arribats.has(p.id) ? t.exporta.si : t.exporta.no,
    ]);
  });
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  descarrega(nomFitxer(S, "assignacions", "csv"), new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
}

export function exportaJSON(S: Planol) {
  descarrega(nomFitxer(S, "planol", "json"), new Blob([JSON.stringify(S, null, 1)], { type: "application/json" }));
}

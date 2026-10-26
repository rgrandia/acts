import Link from "next/link";
import { Check, Play, RotateCcw, X } from "lucide-react";
import { BotoAccio } from "./BotoAccio";
import { canviaEstatTasca } from "@/lib/accions";
import { avui, dataCurta, fmt } from "@/i18n/format";
import type { Diccionari } from "@/i18n/ca";
import type { Area, Tasca } from "@/lib/tipus";

// Una línia de tasca amb les accions d'estat que pot fer qui la mira:
// el superusuari sempre, l'usuari només si la té assignada (ho torna a
// comprovar l'RLS).
export function FilaTasca({
  tasca,
  t,
  idioma,
  area,
  persona,
  potCanviar,
  esdeveniment,
}: {
  tasca: Tasca;
  t: Diccionari;
  idioma: "ca" | "es";
  area?: Area;
  persona?: string;
  potCanviar: boolean;
  esdeveniment?: string;
}) {
  const oberta = tasca.estat === "pendent" || tasca.estat === "en_curs";
  const vencuda = oberta && tasca.data_limit !== null && tasca.data_limit < avui();

  return (
    <li className="fila px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex-1 min-w-48">
        <Link
          href={`/e/${tasca.esdeveniment_id}/tasques/${tasca.id}`}
          className={`font-medium hover:underline ${oberta ? "" : "line-through suau"}`}
        >
          {tasca.titol}
        </Link>
        <div className="petit suau flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
          {esdeveniment && <span>{esdeveniment}</span>}
          {area && (
            <span className="inline-flex items-center gap-1">
              <span className="punt" style={{ background: area.color }} />
              {area.nom}
            </span>
          )}
          {persona && <span>· {persona}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {tasca.prioritat === "alta" && oberta && (
          <span className="etiqueta etiqueta-alta">{t.tasques.prioritats.alta}</span>
        )}
        {tasca.estat === "en_curs" && <span className="etiqueta">{t.tasques.estats.en_curs}</span>}
        {tasca.estat === "feta" && <span className="etiqueta etiqueta-feta">{t.tasques.estats.feta}</span>}
        {tasca.estat === "cancellada" && <span className="etiqueta">{t.tasques.estats.cancellada}</span>}
        {tasca.data_limit && oberta && (
          <span className={`etiqueta ${vencuda ? "etiqueta-vencuda" : ""}`}>
            {vencuda ? `${t.tasques.vencuda} · ` : ""}
            {fmt(t.tasques.venc, { data: dataCurta(tasca.data_limit, idioma) })}
            {tasca.hora_limit ? ` ${tasca.hora_limit.slice(0, 5)}` : ""}
          </span>
        )}
        {potCanviar && oberta && tasca.estat === "pendent" && (
          <BotoAccio accio={canviaEstatTasca.bind(null, tasca.id, "en_curs")} titol={t.tasques.accions.comenca}>
            <Play size={14} aria-hidden />
          </BotoAccio>
        )}
        {potCanviar && oberta && (
          <BotoAccio accio={canviaEstatTasca.bind(null, tasca.id, "feta")} titol={t.tasques.accions.feta}>
            <Check size={14} aria-hidden /> {t.tasques.accions.feta}
          </BotoAccio>
        )}
        {potCanviar && !oberta && (
          <BotoAccio accio={canviaEstatTasca.bind(null, tasca.id, "pendent")} titol={t.tasques.accions.reobre}>
            <RotateCcw size={14} aria-hidden />
          </BotoAccio>
        )}
        {potCanviar && oberta && (
          <BotoAccio accio={canviaEstatTasca.bind(null, tasca.id, "cancellada")} titol={t.tasques.accions.cancella}>
            <X size={14} aria-hidden />
          </BotoAccio>
        )}
      </div>
    </li>
  );
}

import Link from "next/link";
import { Plus, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { elMeuRol, requereixPerfil } from "@/lib/auth/session";
import { obteArees, obteEsdeveniment, obteMembres } from "@/lib/dades";
import { tradueix } from "@/i18n";
import { actualitzaEsdeveniment, creaTasca } from "@/lib/accions";
import { Formulari } from "@/components/Formulari";
import { FilaTasca } from "@/components/FilaTasca";
import { CampsTasca } from "@/components/CampsTasca";
import { CampsEsdeveniment } from "@/components/CampsEsdeveniment";
import { SelectFiltre } from "@/components/SelectFiltre";
import { COLUMNES_TASCA, type Tasca } from "@/lib/tipus";

export const dynamic = "force-dynamic";

const FILTRES = ["obertes", "meves", "tancades", "totes"] as const;
type Filtre = (typeof FILTRES)[number];

export default async function TasquesEsdeveniment({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string; area?: string; persona?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const perfil = await requereixPerfil();
  const [rol, e, arees, membres, { t, idioma }] = await Promise.all([
    elMeuRol(id),
    obteEsdeveniment(id),
    obteArees(id),
    obteMembres(id),
    tradueix(),
  ]);
  const esSuper = rol === "superusuari";
  // Per defecte, qui no és superusuari veu primer les seves.
  const filtre: Filtre = FILTRES.includes(sp.f as Filtre) ? (sp.f as Filtre) : esSuper ? "obertes" : "meves";

  const supabase = await createClient();
  let q = supabase.from("tasques").select(COLUMNES_TASCA).eq("esdeveniment_id", id);
  if (filtre === "obertes" || filtre === "meves") q = q.in("estat", ["pendent", "en_curs"]);
  if (filtre === "tancades") q = q.in("estat", ["feta", "cancellada"]);
  if (filtre === "meves") q = q.eq("assignada_a", perfil.id);
  if (sp.area === "cap") q = q.is("area_id", null);
  else if (sp.area) q = q.eq("area_id", sp.area);
  if (sp.persona === "cap") q = q.is("assignada_a", null);
  else if (sp.persona) q = q.eq("assignada_a", sp.persona);
  const { data } = await q
    .order("data_limit", { ascending: true, nullsFirst: false })
    .order("hora_limit", { ascending: true, nullsFirst: false })
    .order("creat_el", { ascending: true });
  const tasques = (data ?? []) as Tasca[];

  const mapaArees = new Map(arees.map((a) => [a.id, a]));
  const noms = new Map(membres.map((m) => [m.perfil_id, m.nom]));
  const enllac = (canvis: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const tot = { f: sp.f, area: sp.area, persona: sp.persona, ...canvis };
    for (const [k, v] of Object.entries(tot)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/e/${id}?${s}` : `/e/${id}`;
  };

  return (
    <div className="grid gap-4">
      {esSuper && (
        <div className="grid gap-2">
          <details className="panell">
            <summary className="px-4 py-3 cursor-pointer font-semibold flex items-center gap-2">
              <Plus size={16} aria-hidden /> {t.tasques.nova}
            </summary>
            <div className="px-4 pb-4">
              <Formulari accio={creaTasca} boto={t.tasques.crea} buidaEnAcabar>
                <CampsTasca t={t} esdevenimentId={id} arees={arees} membres={membres} />
              </Formulari>
            </div>
          </details>
          {e && (
            <details className="panell">
              <summary className="px-4 py-3 cursor-pointer font-semibold flex items-center gap-2">
                <Settings2 size={16} aria-hidden /> {t.esdeveniment.editar}
              </summary>
              <div className="px-4 pb-4">
                <Formulari accio={actualitzaEsdeveniment} boto={t.esdeveniment.desa}>
                  <CampsEsdeveniment t={t} e={e} />
                </Formulari>
              </div>
            </details>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTRES.map((f) => (
          <Link key={f} href={enllac({ f })} className="xip" aria-current={f === filtre ? "true" : undefined}>
            {t.tasques.filtres[f]}
          </Link>
        ))}
        <span className="flex-1" />
        <SelectFiltre
          nom="area"
          etiqueta={t.tasques.area}
          opcions={[
            ["", t.tasques.filtres.qualsevolArea],
            ["cap", t.tasques.senseArea],
            ...arees.filter((a) => a.activa).map((a) => [a.id, a.nom] as [string, string]),
          ]}
        />
        {filtre !== "meves" && (
          <SelectFiltre
            nom="persona"
            etiqueta={t.tasques.assignada}
            opcions={[
              ["", t.tasques.filtres.qualsevolPersona],
              ["cap", t.tasques.filtres.senseAssignar],
              ...membres.filter((m) => m.actiu).map((m) => [m.perfil_id, m.nom] as [string, string]),
            ]}
          />
        )}
      </div>

      {tasques.length ? (
        <ul className="panell overflow-hidden">
          {tasques.map((x) => (
            <FilaTasca
              key={x.id}
              tasca={x}
              t={t}
              idioma={idioma}
              area={x.area_id ? mapaArees.get(x.area_id) : undefined}
              persona={x.assignada_a ? noms.get(x.assignada_a) : undefined}
              potCanviar={esSuper || x.assignada_a === perfil.id}
            />
          ))}
        </ul>
      ) : (
        <p className="suau">{t.tasques.cap}</p>
      )}
    </div>
  );
}

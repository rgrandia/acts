import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { elMeuRol, requereixPerfil } from "@/lib/auth/session";
import { obteArees, obteMembres } from "@/lib/dades";
import { tradueix } from "@/i18n";
import { fmt, momentCurt } from "@/i18n/format";
import { actualitzaTasca, comenta } from "@/lib/accions";
import { Formulari } from "@/components/Formulari";
import { FilaTasca } from "@/components/FilaTasca";
import { CampsTasca } from "@/components/CampsTasca";
import { COLUMNES_TASCA, type Tasca } from "@/lib/tipus";

export const dynamic = "force-dynamic";

export default async function DetallTasca({ params }: { params: Promise<{ id: string; tascaId: string }> }) {
  const { id, tascaId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tascaId)) notFound();
  const perfil = await requereixPerfil();
  const supabase = await createClient();
  const [rol, arees, membres, { t, idioma }, { data }, { data: comentaris }] = await Promise.all([
    elMeuRol(id),
    obteArees(id),
    obteMembres(id),
    tradueix(),
    supabase.from("tasques").select(COLUMNES_TASCA).eq("id", tascaId).eq("esdeveniment_id", id).maybeSingle(),
    supabase.from("comentaris").select("id, autor_id, text, creat_el").eq("tasca_id", tascaId).order("creat_el"),
  ]);
  const tasca = data as Tasca | null;
  if (!tasca) notFound();

  const esSuper = rol === "superusuari";
  const noms = new Map(membres.map((m) => [m.perfil_id, m.nom]));
  const area = arees.find((a) => a.id === tasca.area_id);

  return (
    <div className="grid gap-4 max-w-3xl">
      <Link href={`/e/${id}`} className="petit suau inline-flex items-center gap-1 hover:underline">
        <ArrowLeft size={14} aria-hidden /> {t.tasques.tornar}
      </Link>

      <ul className="panell overflow-hidden">
        <FilaTasca
          tasca={tasca}
          t={t}
          idioma={idioma}
          area={area}
          persona={tasca.assignada_a ? noms.get(tasca.assignada_a) : undefined}
          potCanviar={esSuper || tasca.assignada_a === perfil.id}
        />
      </ul>

      {tasca.descripcio && <p className="panell p-4 whitespace-pre-wrap">{tasca.descripcio}</p>}
      {tasca.creada_per && (
        <p className="petit suau">
          {fmt(t.tasques.creadaPer, { nom: noms.get(tasca.creada_per) ?? "?" })} · {momentCurt(tasca.creat_el, idioma)}
        </p>
      )}

      {esSuper ? (
        <details className="panell">
          <summary className="px-4 py-3 cursor-pointer font-semibold">{t.tasques.editar}</summary>
          <div className="px-4 pb-4">
            <Formulari accio={actualitzaTasca} boto={t.tasques.desa}>
              <CampsTasca t={t} esdevenimentId={id} arees={arees} membres={membres} tasca={tasca} />
            </Formulari>
          </div>
        </details>
      ) : (
        <p className="petit suau">{t.tasques.nomesEstat}</p>
      )}

      <section className="grid gap-2">
        <h2 className="titol-seccio">{t.tasques.comentaris}</h2>
        {!comentaris?.length && <p className="suau petit">{t.tasques.capComentari}</p>}
        <ul className="grid gap-2">
          {(comentaris ?? []).map((c) => (
            <li key={c.id} className="panell p-3">
              <div className="petit suau">
                <b style={{ color: "var(--text)" }}>{noms.get(c.autor_id) ?? "?"}</b> · {momentCurt(c.creat_el, idioma)}
              </div>
              <p className="whitespace-pre-wrap mt-1">{c.text}</p>
            </li>
          ))}
        </ul>
        <Formulari accio={comenta} boto={t.tasques.comenta} buidaEnAcabar>
          <input type="hidden" name="tasca_id" value={tasca.id} />
          <input type="hidden" name="esdeveniment_id" value={id} />
          <textarea name="text" rows={2} required placeholder={t.tasques.placeholderComentari} aria-label={t.tasques.comentaris} />
        </Formulari>
      </section>
    </div>
  );
}

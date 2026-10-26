import Link from "next/link";
import { Archive, LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { elMeuRol } from "@/lib/auth/session";
import { tradueix } from "@/i18n";
import { fmt, momentCurt } from "@/i18n/format";
import { arxivaPlanol, creaPlanol } from "@/lib/accions-seating";
import { Formulari } from "@/components/Formulari";
import { BotoAccio } from "@/components/BotoAccio";

export const dynamic = "force-dynamic";

type Fila = {
  id: string;
  nom: string;
  actualitzat_el: string;
  seients: number | null;
  convidats: number | null;
};

export default async function Planols({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [rol, { t, idioma }] = await Promise.all([elMeuRol(id), tradueix()]);
  const esSuper = rol === "superusuari";
  const supabase = await createClient();
  // Els comptes es calculen a Postgres per no baixar els documents sencers.
  const { data, error } = await supabase.rpc("resum_planols", { p_esdeveniment: id });
  if (error) console.error("planols:", error.code, error.message);
  const planols = (data ?? []) as Fila[];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] items-start">
      <section className="grid gap-2">
        {planols.length ? (
          <ul className="panell overflow-hidden">
            {planols.map((p) => (
              <li key={p.id} className="fila px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <LayoutGrid size={16} aria-hidden className="suau" />
                <Link href={`/e/${id}/planols/${p.id}`} className="flex-1 min-w-48 font-medium hover:underline">
                  {p.nom}
                </Link>
                <span className="petit suau">
                  {fmt(t.seating.llista.seients, { n: p.seients ?? 0 })} · {fmt(t.seating.llista.convidats, { n: p.convidats ?? 0 })} ·{" "}
                  {fmt(t.seating.llista.desat, { data: momentCurt(p.actualitzat_el, idioma) })}
                </span>
                {esSuper && (
                  <BotoAccio accio={arxivaPlanol.bind(null, id, p.id)} titol={t.seating.llista.arxiva} className="boto-link">
                    <Archive size={14} aria-hidden />
                  </BotoAccio>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="suau">{t.seating.llista.cap}</p>
        )}
      </section>

      {esSuper && (
        <aside className="panell p-4 grid gap-3">
          <h2 className="titol-seccio">{t.seating.llista.nou}</h2>
          <p className="petit suau">{t.seating.llista.ajuda}</p>
          <Formulari accio={creaPlanol} boto={t.seating.llista.crea}>
            <input type="hidden" name="esdeveniment_id" value={id} />
            <label>
              {t.seating.llista.nom}
              <input name="nom" required maxLength={120} />
            </label>
          </Formulari>
        </aside>
      )}
    </div>
  );
}

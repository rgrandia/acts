import Link from "next/link";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requereixPerfil } from "@/lib/auth/session";
import { tradueix } from "@/i18n";
import { avui, dataCurta, fmt } from "@/i18n/format";
import { FilaTasca } from "@/components/FilaTasca";
import { COLUMNES_TASCA, type Area, type Esdeveniment, type Tasca } from "@/lib/tipus";

export const dynamic = "force-dynamic";

export default async function Inici() {
  const perfil = await requereixPerfil();
  const { t, idioma } = await tradueix();
  const supabase = await createClient();

  // Només els esdeveniments on soc membre actiu (el propietari, per RLS, els
  // veuria tots; a l'inici li ensenyem igualment només els seus).
  const [{ data: meus, error: e1 }, { data: tasques, error: e2 }] = await Promise.all([
    supabase
      .from("membres")
      .select("rol, esdeveniments(id, nom, descripcio, lloc, data_inici, data_fi, estat)")
      .eq("perfil_id", perfil.id)
      .eq("actiu", true),
    supabase
      .from("tasques")
      .select(COLUMNES_TASCA)
      .eq("assignada_a", perfil.id)
      .in("estat", ["pendent", "en_curs"])
      .order("data_limit", { ascending: true, nullsFirst: false })
      .order("hora_limit", { ascending: true, nullsFirst: false }),
  ]);

  if (e1 || e2) console.error("inici:", e1?.message, e2?.message);

  const esdeveniments = (meus ?? [])
    .map((m) => ({ rol: m.rol, e: m.esdeveniments as unknown as Esdeveniment }))
    .filter((x) => x.e && x.e.estat !== "cancellat" && x.e.estat !== "tancat")
    .sort((a, b) => (a.e.data_inici ?? "9999").localeCompare(b.e.data_inici ?? "9999"));
  const nomEsd = new Map(esdeveniments.map((x) => [x.e.id, x.e.nom]));

  const ids = [...new Set((tasques ?? []).map((x) => x.esdeveniment_id))];
  const { data: arees } = ids.length
    ? await supabase.from("arees").select("id, nom, color, activa").in("esdeveniment_id", ids)
    : { data: [] };
  const mapaArees = new Map((arees as Area[] | null ?? []).map((a) => [a.id, a]));

  const hui = avui();
  const grups: [string, Tasca[]][] = [
    [t.inici.vencudes, []],
    [t.inici.avui, []],
    [t.inici.properes, []],
    [t.inici.senseData, []],
  ];
  for (const x of (tasques ?? []) as Tasca[]) {
    const i = !x.data_limit ? 3 : x.data_limit < hui ? 0 : x.data_limit === hui ? 1 : 2;
    grups[i][1].push(x);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem] items-start">
      <section className="grid gap-3">
        <h2 className="titol-seccio">{t.inici.lesMevesTasques}</h2>
        {!tasques?.length && <p className="suau">{t.inici.capTasca}</p>}
        {grups
          .filter(([, llista]) => llista.length)
          .map(([nom, llista]) => (
            <div key={nom} className="grid gap-1.5">
              <h3 className="text-sm font-semibold">{nom} <span className="suau">· {llista.length}</span></h3>
              <ul className="panell overflow-hidden">
                {llista.map((x) => (
                  <FilaTasca
                    key={x.id}
                    tasca={x}
                    t={t}
                    idioma={idioma}
                    area={x.area_id ? mapaArees.get(x.area_id) : undefined}
                    esdeveniment={nomEsd.get(x.esdeveniment_id)}
                    potCanviar
                  />
                ))}
              </ul>
            </div>
          ))}
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="titol-seccio">{t.inici.elsMeusEsdeveniments}</h2>
          {perfil.propietari && (
            <Link href="/esdeveniments/nou" className="boto boto-petit">
              <Plus size={14} aria-hidden /> {t.inici.nouEsdeveniment}
            </Link>
          )}
        </div>
        {!esdeveniments.length && (
          <p className="suau petit">{fmt(t.inici.capEsdeveniment, { email: perfil.email })}</p>
        )}
        <ul className="grid gap-2">
          {esdeveniments.map(({ e, rol }) => (
            <li key={e.id}>
              <Link href={`/e/${e.id}`} className="panell block p-4 hover:border-[var(--suau)]">
                <div className="font-semibold">{e.nom}</div>
                <div className="petit suau mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {e.data_inici && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={13} aria-hidden />
                      {dataCurta(e.data_inici, idioma)}
                      {e.data_fi && e.data_fi !== e.data_inici ? ` – ${dataCurta(e.data_fi, idioma)}` : ""}
                    </span>
                  )}
                  {e.lloc && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} aria-hidden />
                      {e.lloc}
                    </span>
                  )}
                  <span>{t.rols[rol as "superusuari" | "usuari"]}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

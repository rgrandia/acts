import { notFound } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { elMeuRol } from "@/lib/auth/session";
import { obteEsdeveniment } from "@/lib/dades";
import { tradueix } from "@/i18n";
import { dataLlarga } from "@/i18n/format";
import { Pestanyes } from "@/components/Pestanyes";

export default async function LayoutEsdeveniment({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [e, rol, { t, idioma }] = await Promise.all([obteEsdeveniment(id), elMeuRol(id), tradueix()]);
  // L'RLS no retorna l'esdeveniment a qui no n'és membre: per a ell no existeix.
  if (!e || !rol) notFound();

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-2xl font-bold tracking-tight">{e.nom}</h1>
          <span className="etiqueta">{t.esdeveniment.estats[e.estat]}</span>
        </div>
        <div className="petit suau flex flex-wrap gap-x-4 gap-y-1">
          {e.data_inici && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={13} aria-hidden />
              {dataLlarga(e.data_inici, idioma)}
              {e.data_fi && e.data_fi !== e.data_inici ? ` – ${dataLlarga(e.data_fi, idioma)}` : ""}
            </span>
          )}
          {e.lloc && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={13} aria-hidden />
              {e.lloc}
            </span>
          )}
          <span>
            {t.esdeveniment.soc}: <b>{t.rols[rol]}</b>
          </span>
        </div>
      </div>
      <Pestanyes
        items={[
          { href: `/e/${id}`, etiqueta: t.pestanyes.tasques, prefixos: [`/e/${id}/tasques`] },
          { href: `/e/${id}/planols`, etiqueta: t.seating.pestanya, prefixos: [`/e/${id}/planols/`] },
          { href: `/e/${id}/equip`, etiqueta: t.pestanyes.equip, prefixos: [`/e/${id}/equip/`] },
        ]}
      />
      {children}
    </div>
  );
}

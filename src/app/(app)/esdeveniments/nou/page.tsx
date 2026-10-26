import { notFound } from "next/navigation";
import { requereixPerfil } from "@/lib/auth/session";
import { tradueix } from "@/i18n";
import { creaEsdeveniment } from "@/lib/accions";
import { Formulari } from "@/components/Formulari";
import { CampsEsdeveniment } from "@/components/CampsEsdeveniment";

export default async function NouEsdeveniment() {
  const perfil = await requereixPerfil();
  // L'RLS ja ho impedeix; aquí només evitem ensenyar un formulari inútil.
  if (!perfil.propietari) notFound();
  const { t } = await tradueix();
  return (
    <div className="max-w-lg grid gap-4">
      <h1 className="text-xl font-semibold">{t.inici.nouEsdeveniment}</h1>
      <div className="panell p-5">
        <Formulari accio={creaEsdeveniment} boto={t.esdeveniment.crea}>
          <CampsEsdeveniment t={t} />
        </Formulari>
      </div>
    </div>
  );
}

import { requereixPerfil } from "@/lib/auth/session";
import { IDIOMES, tradueix } from "@/i18n";
import { desaPerfil } from "@/lib/accions";
import { Formulari } from "@/components/Formulari";

export const dynamic = "force-dynamic";

export default async function Perfil() {
  const perfil = await requereixPerfil();
  const { t } = await tradueix();
  return (
    <div className="max-w-md grid gap-4">
      <h1 className="text-xl font-semibold">{t.perfil.titol}</h1>
      <div className="panell p-5 grid gap-4">
        <div className="petit">
          <div className="suau">{t.perfil.correu}</div>
          <div>{perfil.email}</div>
        </div>
        <Formulari accio={desaPerfil} boto={t.perfil.desa}>
          <label>
            {t.perfil.nom}
            <input name="nom" defaultValue={perfil.nom} required maxLength={120} />
          </label>
          <label>
            {t.perfil.idioma}
            <select name="idioma" defaultValue={perfil.idioma}>
              {IDIOMES.map((i) => (
                <option key={i} value={i}>{t.idiomes[i]}</option>
              ))}
            </select>
          </label>
        </Formulari>
        {perfil.propietari && <p className="petit suau">{t.perfil.propietari}</p>}
      </div>
    </div>
  );
}

import type { Diccionari } from "@/i18n/ca";
import type { MembreAmbNom } from "@/lib/dades";
import { PRIORITATS, type Area, type Tasca } from "@/lib/tipus";

export function CampsTasca({
  t,
  esdevenimentId,
  arees,
  membres,
  tasca,
}: {
  t: Diccionari;
  esdevenimentId: string;
  arees: Area[];
  membres: MembreAmbNom[];
  tasca?: Tasca;
}) {
  const actives = arees.filter((a) => a.activa || a.id === tasca?.area_id);
  const persones = membres.filter((m) => m.actiu || m.perfil_id === tasca?.assignada_a);
  return (
    <>
      <input type="hidden" name="esdeveniment_id" value={esdevenimentId} />
      {tasca && <input type="hidden" name="id" value={tasca.id} />}
      <label>
        {t.tasques.titol}
        <input name="titol" defaultValue={tasca?.titol} required maxLength={200} />
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <label>
          {t.tasques.assignada}
          <select name="assignada_a" defaultValue={tasca?.assignada_a ?? ""}>
            <option value="">{t.tasques.ningu}</option>
            {persones.map((m) => (
              <option key={m.perfil_id} value={m.perfil_id}>{m.nom}</option>
            ))}
          </select>
        </label>
        <label>
          {t.tasques.area}
          <select name="area_id" defaultValue={tasca?.area_id ?? ""}>
            <option value="">{t.tasques.senseArea}</option>
            {actives.map((a) => (
              <option key={a.id} value={a.id}>{a.nom}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label>
          {t.tasques.dataLimit}
          <input type="date" name="data_limit" defaultValue={tasca?.data_limit ?? ""} />
        </label>
        <label>
          {t.tasques.hora}
          <input type="time" name="hora_limit" defaultValue={tasca?.hora_limit?.slice(0, 5) ?? ""} />
        </label>
        <label>
          {t.tasques.prioritat}
          <select name="prioritat" defaultValue={tasca?.prioritat ?? "normal"}>
            {PRIORITATS.map((p) => (
              <option key={p} value={p}>{t.tasques.prioritats[p]}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {t.tasques.descripcio}
        <textarea name="descripcio" rows={3} defaultValue={tasca?.descripcio ?? ""} />
      </label>
    </>
  );
}

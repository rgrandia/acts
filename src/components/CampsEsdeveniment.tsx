import type { Diccionari } from "@/i18n/ca";
import { ESTATS_ESDEVENIMENT, type Esdeveniment } from "@/lib/tipus";

export function CampsEsdeveniment({ t, e }: { t: Diccionari; e?: Esdeveniment }) {
  return (
    <>
      {e && <input type="hidden" name="id" value={e.id} />}
      <label>
        {t.esdeveniment.nom}
        <input name="nom" defaultValue={e?.nom} required maxLength={200} />
      </label>
      <label>
        {t.esdeveniment.lloc}
        <input name="lloc" defaultValue={e?.lloc ?? ""} maxLength={200} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          {t.esdeveniment.dataInici}
          <input type="date" name="data_inici" defaultValue={e?.data_inici ?? ""} />
        </label>
        <label>
          {t.esdeveniment.dataFi}
          <input type="date" name="data_fi" defaultValue={e?.data_fi ?? ""} />
        </label>
      </div>
      {e && (
        <label>
          {t.esdeveniment.estat}
          <select name="estat" defaultValue={e.estat}>
            {ESTATS_ESDEVENIMENT.map((s) => (
              <option key={s} value={s}>{t.esdeveniment.estats[s]}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        {t.esdeveniment.descripcio}
        <textarea name="descripcio" rows={3} defaultValue={e?.descripcio ?? ""} />
      </label>
    </>
  );
}

import { Archive, ShieldCheck, ShieldOff, UserMinus, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { elMeuRol, requereixPerfil } from "@/lib/auth/session";
import { obteArees, obteMembres } from "@/lib/dades";
import { tradueix } from "@/i18n";
import { dataCurta } from "@/i18n/format";
import { actualitzaMembre, arxivaArea, cancellaInvitacio, convida, creaArea } from "@/lib/accions";
import { Formulari } from "@/components/Formulari";
import { BotoAccio } from "@/components/BotoAccio";
import { ROLS } from "@/lib/tipus";

export const dynamic = "force-dynamic";

export default async function Equip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const perfil = await requereixPerfil();
  const [rol, membres, arees, { t, idioma }] = await Promise.all([
    elMeuRol(id),
    obteMembres(id),
    obteArees(id),
    tradueix(),
  ]);
  const esSuper = rol === "superusuari";

  // Les invitacions només les veu un superusuari (RLS); als altres els torna buit.
  const supabase = await createClient();
  const { data: invitacions } = esSuper
    ? await supabase
        .from("invitacions")
        .select("id, email, rol, creat_el")
        .eq("esdeveniment_id", id)
        .is("acceptada_el", null)
        .is("cancellada_el", null)
        .order("creat_el")
    : { data: [] };

  const actius = membres.filter((m) => m.actiu);
  const inactius = membres.filter((m) => !m.actiu);
  const mapaArees = new Map(arees.map((a) => [a.id, a]));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem] items-start">
      <div className="grid gap-6">
        <section className="grid gap-2">
          <h2 className="titol-seccio">{t.equip.membres} · {actius.length}</h2>
          <ul className="panell overflow-hidden">
            {actius.map((m) => {
              const area = m.area_id ? mapaArees.get(m.area_id) : undefined;
              return (
                <li key={m.perfil_id} className="fila px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="flex-1 min-w-48">
                    <div className="font-medium">
                      {m.nom} {m.perfil_id === perfil.id && <span className="suau petit">({t.equip.tu})</span>}
                    </div>
                    <div className="petit suau">{m.email}</div>
                  </div>
                  {area && (
                    <span className="etiqueta">
                      <span className="punt" style={{ background: area.color }} />
                      {area.nom}
                    </span>
                  )}
                  <span className={`etiqueta ${m.rol === "superusuari" ? "etiqueta-alta" : ""}`}>{t.rols[m.rol]}</span>
                  {esSuper && (
                    <span className="flex gap-1">
                      {m.rol === "usuari" ? (
                        <BotoAccio accio={actualitzaMembre.bind(null, id, m.perfil_id, { rol: "superusuari" })} titol={t.equip.ferSuper}>
                          <ShieldCheck size={14} aria-hidden />
                        </BotoAccio>
                      ) : (
                        <BotoAccio accio={actualitzaMembre.bind(null, id, m.perfil_id, { rol: "usuari" })} titol={t.equip.ferUsuari}>
                          <ShieldOff size={14} aria-hidden />
                        </BotoAccio>
                      )}
                      <BotoAccio accio={actualitzaMembre.bind(null, id, m.perfil_id, { actiu: false })} titol={t.equip.desactiva}>
                        <UserMinus size={14} aria-hidden />
                      </BotoAccio>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {esSuper && !!invitacions?.length && (
          <section className="grid gap-2">
            <h2 className="titol-seccio">{t.equip.invitacions} · {invitacions.length}</h2>
            <ul className="panell overflow-hidden">
              {invitacions.map((i) => (
                <li key={i.id} className="fila px-4 py-3 flex flex-wrap items-center gap-3">
                  <span className="flex-1">{i.email}</span>
                  <span className="etiqueta">{t.rols[i.rol as "superusuari" | "usuari"]}</span>
                  <span className="petit suau">{dataCurta(i.creat_el.slice(0, 10), idioma)}</span>
                  <BotoAccio accio={cancellaInvitacio.bind(null, id, i.id)}>{t.equip.cancellaInvitacio}</BotoAccio>
                </li>
              ))}
            </ul>
          </section>
        )}

        {esSuper && inactius.length > 0 && (
          <section className="grid gap-2">
            <h2 className="titol-seccio">{t.equip.inactius}</h2>
            <ul className="panell overflow-hidden">
              {inactius.map((m) => (
                <li key={m.perfil_id} className="fila px-4 py-3 flex items-center gap-3">
                  <span className="flex-1 suau">{m.nom} · {m.email}</span>
                  <BotoAccio accio={actualitzaMembre.bind(null, id, m.perfil_id, { actiu: true })} titol={t.equip.reactiva}>
                    <UserPlus size={14} aria-hidden />
                  </BotoAccio>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <aside className="grid gap-6">
        {esSuper && (
          <section className="panell p-4 grid gap-3">
            <h2 className="titol-seccio">{t.equip.convida}</h2>
            <Formulari accio={convida} boto={t.equip.convidaBoto} buidaEnAcabar>
              <input type="hidden" name="esdeveniment_id" value={id} />
              <label>
                {t.equip.correu}
                <input name="email" type="email" required autoComplete="off" />
              </label>
              <label>
                {t.equip.rol}
                <select name="rol" defaultValue="usuari">
                  {ROLS.map((r) => (
                    <option key={r} value={r}>{t.rols[r]}</option>
                  ))}
                </select>
              </label>
            </Formulari>
            <p className="petit suau">{t.equip.ajudaInvitacio}</p>
          </section>
        )}

        <section className="grid gap-2">
          <h2 className="titol-seccio">{t.equip.arees}</h2>
          <p className="petit suau">{t.equip.ajudaArees}</p>
          {!arees.some((a) => a.activa) && <p className="petit suau">{t.equip.capArea}</p>}
          <ul className="grid gap-1">
            {arees.filter((a) => a.activa).map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="punt" style={{ background: a.color }} />
                <span className="flex-1">{a.nom}</span>
                {esSuper && (
                  <BotoAccio accio={arxivaArea.bind(null, id, a.id)} titol={t.equip.desactivaArea} className="boto-link">
                    <Archive size={14} aria-hidden />
                  </BotoAccio>
                )}
              </li>
            ))}
          </ul>
          {esSuper && (
            <Formulari accio={creaArea} boto={t.equip.afegeix} buidaEnAcabar className="formulari mt-2">
              <input type="hidden" name="esdeveniment_id" value={id} />
              <div className="grid grid-cols-[1fr_3.5rem] gap-2">
                <input name="nom" required placeholder={t.equip.nomArea} aria-label={t.equip.nomArea} maxLength={60} />
                <input name="color" type="color" defaultValue="#64748b" aria-label={t.equip.color} />
              </div>
            </Formulari>
          )}
        </section>
      </aside>
    </div>
  );
}

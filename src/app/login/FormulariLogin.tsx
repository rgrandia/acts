"use client";

import { useActionState } from "react";
import { accioLogin, type EstatLogin } from "@/lib/auth/actions";
import { fmt } from "@/i18n/format";
import type { Diccionari } from "@/i18n/ca";

export function FormulariLogin({ t, errorInicial }: { t: Diccionari["login"]; errorInicial?: string }) {
  const [estat, envia, pendent] = useActionState<EstatLogin, FormData>(accioLogin, { pas: "correu", error: errorInicial });

  if (estat.pas === "codi") {
    return (
      <form action={envia} className="formulari">
        <p className="suau">{fmt(t.codiEnviat, { email: estat.email ?? "" })}</p>
        <input type="hidden" name="email" value={estat.email} />
        <label>
          {t.codi}
          <input
            name="codi"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,10}"
            required
            autoFocus
          />
        </label>
        <button className="boto boto-primari" disabled={pendent}>{t.entra}</button>
        <button className="boto-link" name="torna" value="1" formNoValidate>{t.canviaCorreu}</button>
        {estat.error && <p className="error" role="alert">{estat.error}</p>}
      </form>
    );
  }

  return (
    <form action={envia} className="formulari">
      <label>
        {t.correu}
        <input name="email" type="email" autoComplete="email" defaultValue={estat.email} required autoFocus />
      </label>
      <button className="boto boto-primari" disabled={pendent}>{t.enviaCodi}</button>
      {estat.error && <p className="error" role="alert">{estat.error}</p>}
      <p className="petit suau">{t.ajuda}</p>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Resultat } from "@/lib/accions";

// Formulari amb una server action. Mostra l'error o el missatge d'èxit i,
// si es demana, es buida quan ha anat bé (per afegir-ne un altre de seguida).
export function Formulari({
  accio,
  boto,
  children,
  buidaEnAcabar = false,
  className = "formulari",
}: {
  accio: (prev: Resultat, fd: FormData) => Promise<Resultat>;
  boto: string;
  children: React.ReactNode;
  buidaEnAcabar?: boolean;
  className?: string;
}) {
  const [estat, envia, pendent] = useActionState(accio, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estat.ok && buidaEnAcabar) ref.current?.reset();
  }, [estat, buidaEnAcabar]);

  return (
    <form ref={ref} action={envia} className={className}>
      {children}
      <div className="flex items-center gap-3 flex-wrap">
        <button className="boto boto-primari" disabled={pendent}>{boto}</button>
        {estat.error && <span className="error" role="alert">{estat.error}</span>}
        {estat.ok && estat.ok !== "1" && <span className="ok">{estat.ok}</span>}
      </div>
    </form>
  );
}

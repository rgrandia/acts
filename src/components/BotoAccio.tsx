"use client";

import { useState, useTransition } from "react";
import type { Resultat } from "@/lib/accions";

// Botó que crida una server action ja lligada als seus arguments (bind).
export function BotoAccio({
  accio,
  children,
  titol,
  className = "boto boto-petit",
}: {
  accio: () => Promise<Resultat>;
  children: React.ReactNode;
  titol?: string;
  className?: string;
}) {
  const [pendent, inicia] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className={className}
        disabled={pendent}
        title={titol}
        aria-label={titol}
        onClick={() =>
          inicia(async () => {
            const r = await accio();
            setError(r.error);
          })
        }
      >
        {children}
      </button>
      {error && <span className="error" role="alert">{error}</span>}
    </span>
  );
}

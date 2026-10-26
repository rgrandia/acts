"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { canviaIdiomaGaleta } from "@/lib/auth/actions";

export function SelectorIdiomaLogin({ actual }: { actual: "ca" | "es" }) {
  const router = useRouter();
  const [pendent, inicia] = useTransition();
  return (
    <div className="flex gap-3 petit">
      {(["ca", "es"] as const).map((i) => (
        <button
          key={i}
          className={i === actual ? "font-semibold" : "suau boto-link"}
          disabled={pendent || i === actual}
          onClick={() => inicia(async () => { await canviaIdiomaGaleta(i); router.refresh(); })}
        >
          {i === "ca" ? "Català" : "Castellano"}
        </button>
      ))}
    </div>
  );
}

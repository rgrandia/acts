"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Desplegable de filtre que canvia un paràmetre de la URL.
export function SelectFiltre({ nom, etiqueta, opcions }: { nom: string; etiqueta: string; opcions: [string, string][] }) {
  const router = useRouter();
  const ruta = usePathname();
  const params = useSearchParams();
  return (
    <select
      aria-label={etiqueta}
      className="w-auto py-1 text-sm"
      value={params.get(nom) ?? ""}
      onChange={(e) => {
        const p = new URLSearchParams(params);
        if (e.target.value) p.set(nom, e.target.value);
        else p.delete(nom);
        const s = p.toString();
        router.push(s ? `${ruta}?${s}` : ruta);
      }}
    >
      {opcions.map(([v, text]) => (
        <option key={v} value={v}>{text}</option>
      ))}
    </select>
  );
}

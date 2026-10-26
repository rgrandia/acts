"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Pestanyes({ items }: { items: { href: string; etiqueta: string; prefixos?: string[] }[] }) {
  const ruta = usePathname();
  return (
    <nav className="flex gap-5 border-b" style={{ borderColor: "var(--linia)" }}>
      {items.map((i) => {
        const actiu = ruta === i.href || (i.prefixos ?? []).some((p) => ruta.startsWith(p));
        return (
          <Link key={i.href} href={i.href} className="pestanya" aria-current={actiu ? "page" : undefined}>
            {i.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}

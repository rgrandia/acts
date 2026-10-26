import type { Diccionari } from "@/i18n/ca";

type ErrorPg = { code?: string; message?: string; hint?: string | null };

// Tradueix els errors de Postgres/PostgREST a un missatge per a la persona.
// Els triggers posen un `hint` estable perquè no depenguem del text.
export function missatgeError(e: ErrorPg, t: Diccionari): string {
  switch (e.hint) {
    case "ultim_super":
      return t.errors.ultimSuper;
    case "nomes_super":
      return t.errors.nomesSuper;
    case "assignat_no_membre":
      return t.errors.assignatNoMembre;
    case "correu_invalid":
      return t.errors.correuInvalid;
  }
  if (e.code === "42501") return t.errors.sensePermis;
  if (e.code === "23505") return t.errors.duplicat;
  console.error("supabase:", e.code, e.message);
  return t.errors.generic;
}

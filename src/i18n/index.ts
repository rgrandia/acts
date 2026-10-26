import "server-only";
import { cookies, headers } from "next/headers";
import { obteSessio } from "@/lib/auth/session";
import { ca, type Diccionari } from "./ca";
import { es } from "./es";

export type Idioma = "ca" | "es";
export const IDIOMES: Idioma[] = ["ca", "es"];
export const GALETA_IDIOMA = "acts_idioma";

const DICCIONARIS: Record<Idioma, Diccionari> = { ca, es };

export function esIdioma(v: unknown): v is Idioma {
  return v === "ca" || v === "es";
}

// Ordre: el perfil (segueix la persona a qualsevol ordinador), la galeta
// (pantalla de login) i, si no, l'idioma del navegador.
export async function idiomaActual(): Promise<Idioma> {
  const sessio = await obteSessio();
  if (sessio?.perfil) return sessio.perfil.idioma;
  const galeta = (await cookies()).get(GALETA_IDIOMA)?.value;
  if (esIdioma(galeta)) return galeta;
  const navegador = (await headers()).get("accept-language") ?? "";
  return /^\s*ca\b/i.test(navegador) ? "ca" : "es";
}

export async function tradueix(): Promise<{ t: Diccionari; idioma: Idioma }> {
  const idioma = await idiomaActual();
  return { t: DICCIONARIS[idioma], idioma };
}

export function diccionari(idioma: Idioma): Diccionari {
  return DICCIONARIS[idioma];
}

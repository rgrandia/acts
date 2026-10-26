import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Perfil, Rol } from "@/lib/tipus";

export type Sessio = { usuariId: string; email: string | null; perfil: Perfil | null };

export const obteSessio = cache(async (): Promise<Sessio | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;

  const { data: perfil } = await supabase
    .from("perfils")
    .select("id, nom, email, idioma, propietari")
    .eq("id", sub)
    .maybeSingle();

  return {
    usuariId: sub,
    email: (data.claims.email as string | undefined) ?? null,
    perfil: (perfil as Perfil | null) ?? null,
  };
});

// Per a totes les pantalles de l'app: exigeix sessió i perfil.
export async function requereixPerfil(): Promise<Perfil> {
  const sessio = await obteSessio();
  if (!sessio?.perfil) redirect("/login");
  return sessio.perfil;
}

// El meu rol en un esdeveniment, o null si no hi soc. El propietari de la
// plataforma hi compta com a superusuari encara que no en sigui membre
// (mateixa regla que es_super() a la base de dades).
export const elMeuRol = cache(async (esdevenimentId: string): Promise<Rol | null> => {
  const perfil = await requereixPerfil();
  const supabase = await createClient();
  const { data } = await supabase
    .from("membres")
    .select("rol, actiu")
    .eq("esdeveniment_id", esdevenimentId)
    .eq("perfil_id", perfil.id)
    .maybeSingle();
  if (data?.actiu) return perfil.propietari ? "superusuari" : (data.rol as Rol);
  return perfil.propietari ? "superusuari" : null;
});

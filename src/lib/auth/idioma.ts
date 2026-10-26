import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { GALETA_IDIOMA } from "@/i18n";

// L'idioma del perfil passa a la galeta perquè el login el recordi.
export async function recordaIdioma(usuariId: string) {
  const supabase = await createClient();
  const { data: perfil } = await supabase.from("perfils").select("idioma").eq("id", usuariId).maybeSingle();
  if (perfil?.idioma) (await cookies()).set(GALETA_IDIOMA, perfil.idioma, { path: "/", maxAge: 31536000 });
}

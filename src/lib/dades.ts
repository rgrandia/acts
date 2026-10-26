import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Area, Esdeveniment, Membre } from "@/lib/tipus";

export type MembreAmbNom = Membre & { nom: string; email: string };

export const obteEsdeveniment = cache(async (id: string): Promise<Esdeveniment | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("esdeveniments")
    .select("id, nom, descripcio, lloc, data_inici, data_fi, estat")
    .eq("id", id)
    .maybeSingle();
  return (data as Esdeveniment | null) ?? null;
});

export const obteArees = cache(async (esdevenimentId: string): Promise<Area[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("arees")
    .select("id, nom, color, activa")
    .eq("esdeveniment_id", esdevenimentId)
    .order("nom");
  return (data as Area[] | null) ?? [];
});

export const obteMembres = cache(async (esdevenimentId: string): Promise<MembreAmbNom[]> => {
  const supabase = await createClient();
  // membres té dues claus cap a perfils (perfil_id i afegit_per): cal dir per quina.
  const { data, error } = await supabase
    .from("membres")
    .select("perfil_id, rol, area_id, actiu, perfils!perfil_id(nom, email)")
    .eq("esdeveniment_id", esdevenimentId);
  if (error) console.error("membres:", error.code, error.message);
  return ((data ?? []) as unknown as (Membre & { perfils: { nom: string; email: string } | null })[])
    .map(({ perfils, ...m }) => ({ ...m, nom: perfils?.nom ?? "?", email: perfils?.email ?? "" }))
    .sort((a, b) => a.nom.localeCompare(b.nom));
});

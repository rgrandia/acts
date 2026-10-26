"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requereixPerfil } from "@/lib/auth/session";
import { tradueix } from "@/i18n";
import { fmt } from "@/i18n/format";
import { missatgeError } from "@/lib/errors";
import { COLORS_ZONES, planolBuit, type Planol } from "@/lib/seating/model.ts";
import type { Resultat } from "@/lib/accions";

// Escriptures del seating. Com la resta: sessió de l'usuari + RLS.

export async function creaPlanol(_: Resultat, fd: FormData): Promise<Resultat> {
  const perfil = await requereixPerfil();
  const { t } = await tradueix();
  const esdevenimentId = String(fd.get("esdeveniment_id") ?? "");
  const nom = String(fd.get("nom") ?? "").trim();
  if (!nom) return { error: fmt(t.errors.obligatori, { camp: t.seating.llista.nom }) };

  // Les zones per defecte neixen en l'idioma de qui crea el plànol; després
  // són dades (es poden reanomenar).
  const zones = (Object.keys(COLORS_ZONES) as (keyof typeof COLORS_ZONES)[]).map((id) => ({
    id,
    name: t.seating.zones[id],
    color: COLORS_ZONES[id],
  }));
  const dades = planolBuit(zones);
  dades.meta.title = nom;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planols")
    .insert({ esdeveniment_id: esdevenimentId, nom, dades, creat_per: perfil.id })
    .select("id")
    .single();
  if (error) return { error: missatgeError(error, t) };
  redirect(`/e/${esdevenimentId}/planols/${data.id}`);
}

export async function arxivaPlanol(esdevenimentId: string, id: string): Promise<Resultat> {
  const { t } = await tradueix();
  const supabase = await createClient();
  const { error, count } = await supabase.from("planols").update({ actiu: false }, { count: "exact" }).eq("id", id);
  if (error) return { error: missatgeError(error, t) };
  if (!count) return { error: t.errors.sensePermis };
  revalidatePath(`/e/${esdevenimentId}/planols`);
  return {};
}

export type ResultatDesar = { versio: number } | { conflicte: true } | { error: string };

export async function desaPlanol(id: string, dades: Planol, versio: number): Promise<ResultatDesar> {
  const { t } = await tradueix();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("desa_planol", { p_planol: id, p_dades: dades, p_versio: versio });
  if (error) {
    if (error.hint === "conflicte_versio") return { conflicte: true };
    return { error: missatgeError(error, t) };
  }
  return { versio: data as number };
}

export async function carregaPlanol(id: string): Promise<{ dades: unknown; versio: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("planols").select("dades, versio").eq("id", id).maybeSingle();
  return data ?? null;
}

// Identificadors de les persones que consten com a arribades.
export async function llegeixArribades(planolId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("arribades").select("persona").eq("planol_id", planolId).eq("arribat", true);
  return (data ?? []).map((r) => r.persona);
}

export async function marcaArribades(planolId: string, persones: string[], arribat: boolean): Promise<Resultat> {
  const { t } = await tradueix();
  if (!persones.length) return {};
  const supabase = await createClient();
  const { error } = await supabase.rpc("marca_arribades", {
    p_planol: planolId,
    p_persones: persones.slice(0, 5000),
    p_arribat: arribat,
  });
  if (error) return { error: missatgeError(error, t) };
  return {};
}

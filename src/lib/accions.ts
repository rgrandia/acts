"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requereixPerfil } from "@/lib/auth/session";
import { GALETA_IDIOMA, esIdioma, tradueix } from "@/i18n";
import { fmt } from "@/i18n/format";
import { missatgeError } from "@/lib/errors";
import {
  ESTATS_ESDEVENIMENT,
  ESTATS_TASCA,
  PRIORITATS,
  ROLS,
  type EstatTasca,
  type Rol,
} from "@/lib/tipus";

// Totes les escriptures passen per aquí, amb la sessió de l'usuari i la clau
// pública: qui pot fer què ho decideix l'RLS. Cap acció esborra res.

export type Resultat = { error?: string; ok?: string };

function text(fd: FormData, clau: string): string {
  return String(fd.get(clau) ?? "").trim();
}
function opcional(fd: FormData, clau: string): string | null {
  return text(fd, clau) || null;
}
function data(fd: FormData, clau: string): string | null {
  const v = text(fd, clau);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}
function hora(fd: FormData, clau: string): string | null {
  const v = text(fd, clau);
  return /^\d{2}:\d{2}$/.test(v) ? v : null;
}
function de<T extends string>(valors: readonly T[], v: string, perDefecte: T): T {
  return (valors as readonly string[]).includes(v) ? (v as T) : perDefecte;
}

// ------------------------------------------------------------------
// Esdeveniments
// ------------------------------------------------------------------

function campsEsdeveniment(fd: FormData) {
  return {
    nom: text(fd, "nom"),
    descripcio: opcional(fd, "descripcio"),
    lloc: opcional(fd, "lloc"),
    data_inici: data(fd, "data_inici"),
    data_fi: data(fd, "data_fi"),
  };
}

export async function creaEsdeveniment(_: Resultat, fd: FormData): Promise<Resultat> {
  const perfil = await requereixPerfil();
  const { t } = await tradueix();
  const camps = campsEsdeveniment(fd);
  if (!camps.nom) return { error: fmt(t.errors.obligatori, { camp: t.esdeveniment.nom }) };
  if (camps.data_inici && camps.data_fi && camps.data_fi < camps.data_inici) return { error: t.esdeveniment.errDates };

  const supabase = await createClient();
  const { data: nou, error } = await supabase
    .from("esdeveniments")
    .insert({ ...camps, creat_per: perfil.id })
    .select("id")
    .single();
  if (error) return { error: missatgeError(error, t) };
  redirect(`/e/${nou.id}`);
}

export async function actualitzaEsdeveniment(_: Resultat, fd: FormData): Promise<Resultat> {
  const { t } = await tradueix();
  const id = text(fd, "id");
  const camps = campsEsdeveniment(fd);
  if (!camps.nom) return { error: fmt(t.errors.obligatori, { camp: t.esdeveniment.nom }) };
  if (camps.data_inici && camps.data_fi && camps.data_fi < camps.data_inici) return { error: t.esdeveniment.errDates };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("esdeveniments")
    .update({ ...camps, estat: de(ESTATS_ESDEVENIMENT, text(fd, "estat"), "preparacio") }, { count: "exact" })
    .eq("id", id);
  if (error) return { error: missatgeError(error, t) };
  if (!count) return { error: t.errors.sensePermis };
  revalidatePath(`/e/${id}`, "layout");
  return { ok: t.perfil.desat };
}

// ------------------------------------------------------------------
// Tasques
// ------------------------------------------------------------------

function campsTasca(fd: FormData) {
  const data_limit = data(fd, "data_limit");
  return {
    titol: text(fd, "titol"),
    descripcio: opcional(fd, "descripcio"),
    area_id: opcional(fd, "area_id"),
    assignada_a: opcional(fd, "assignada_a"),
    data_limit,
    hora_limit: data_limit ? hora(fd, "hora_limit") : null,
    prioritat: de(PRIORITATS, text(fd, "prioritat"), "normal"),
  };
}

export async function creaTasca(_: Resultat, fd: FormData): Promise<Resultat> {
  const perfil = await requereixPerfil();
  const { t } = await tradueix();
  const esdevenimentId = text(fd, "esdeveniment_id");
  const camps = campsTasca(fd);
  if (!camps.titol) return { error: fmt(t.errors.obligatori, { camp: t.tasques.titol }) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasques")
    .insert({ ...camps, esdeveniment_id: esdevenimentId, creada_per: perfil.id });
  if (error) return { error: missatgeError(error, t) };
  revalidatePath(`/e/${esdevenimentId}`);
  return { ok: t.perfil.desat };
}

export async function actualitzaTasca(_: Resultat, fd: FormData): Promise<Resultat> {
  const { t } = await tradueix();
  const id = text(fd, "id");
  const camps = campsTasca(fd);
  if (!camps.titol) return { error: fmt(t.errors.obligatori, { camp: t.tasques.titol }) };

  const supabase = await createClient();
  const { data: fila, error } = await supabase
    .from("tasques")
    .update(camps)
    .eq("id", id)
    .select("esdeveniment_id")
    .maybeSingle();
  if (error) return { error: missatgeError(error, t) };
  if (!fila) return { error: t.errors.sensePermis };
  revalidatePath(`/e/${fila.esdeveniment_id}`, "layout");
  return { ok: t.perfil.desat };
}

// Feta <=> té feta_el (check a la base de dades).
export async function canviaEstatTasca(id: string, estat: EstatTasca): Promise<Resultat> {
  const { t } = await tradueix();
  if (!ESTATS_TASCA.includes(estat)) return { error: t.errors.generic };
  const supabase = await createClient();
  const { data: fila, error } = await supabase
    .from("tasques")
    .update({ estat, feta_el: estat === "feta" ? new Date().toISOString() : null })
    .eq("id", id)
    .select("esdeveniment_id")
    .maybeSingle();
  if (error) return { error: missatgeError(error, t) };
  if (!fila) return { error: t.errors.sensePermis };
  revalidatePath("/");
  revalidatePath(`/e/${fila.esdeveniment_id}`, "layout");
  return {};
}

export async function comenta(_: Resultat, fd: FormData): Promise<Resultat> {
  const perfil = await requereixPerfil();
  const { t } = await tradueix();
  const tascaId = text(fd, "tasca_id");
  const cos = text(fd, "text");
  if (!cos) return {};
  const supabase = await createClient();
  const { error } = await supabase.from("comentaris").insert({ tasca_id: tascaId, text: cos, autor_id: perfil.id });
  if (error) return { error: missatgeError(error, t) };
  revalidatePath(`/e/${text(fd, "esdeveniment_id")}/tasques/${tascaId}`);
  return { ok: "1" };
}

// ------------------------------------------------------------------
// Equip
// ------------------------------------------------------------------

export async function convida(_: Resultat, fd: FormData): Promise<Resultat> {
  const { t } = await tradueix();
  const esdevenimentId = text(fd, "esdeveniment_id");
  const email = text(fd, "email").toLowerCase();
  if (!email) return { error: fmt(t.errors.obligatori, { camp: t.equip.correu }) };

  const supabase = await createClient();
  const { data: resultat, error } = await supabase.rpc("convida_membre", {
    p_esdeveniment: esdevenimentId,
    p_email: email,
    p_rol: de(ROLS, text(fd, "rol"), "usuari"),
  });
  if (error) return { error: missatgeError(error, t) };
  revalidatePath(`/e/${esdevenimentId}/equip`);
  const r = resultat as keyof typeof t.equip.resultat;
  return { ok: t.equip.resultat[r] ?? t.perfil.desat };
}

export async function actualitzaMembre(
  esdevenimentId: string,
  perfilId: string,
  canvis: { rol?: Rol; actiu?: boolean; area_id?: string | null },
): Promise<Resultat> {
  const { t } = await tradueix();
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("membres")
    .update(canvis, { count: "exact" })
    .eq("esdeveniment_id", esdevenimentId)
    .eq("perfil_id", perfilId);
  if (error) return { error: missatgeError(error, t) };
  if (!count) return { error: t.errors.sensePermis };
  revalidatePath(`/e/${esdevenimentId}`, "layout");
  return {};
}

export async function cancellaInvitacio(esdevenimentId: string, id: string): Promise<Resultat> {
  const { t } = await tradueix();
  const supabase = await createClient();
  const { error } = await supabase
    .from("invitacions")
    .update({ cancellada_el: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: missatgeError(error, t) };
  revalidatePath(`/e/${esdevenimentId}/equip`);
  return {};
}

export async function creaArea(_: Resultat, fd: FormData): Promise<Resultat> {
  const { t } = await tradueix();
  const esdevenimentId = text(fd, "esdeveniment_id");
  const nom = text(fd, "nom");
  if (!nom) return { error: fmt(t.errors.obligatori, { camp: t.equip.nomArea }) };
  const color = /^#[0-9a-fA-F]{6}$/.test(text(fd, "color")) ? text(fd, "color") : "#64748B";
  const supabase = await createClient();
  const { error } = await supabase.from("arees").insert({ esdeveniment_id: esdevenimentId, nom, color });
  if (error) return { error: missatgeError(error, t) };
  revalidatePath(`/e/${esdevenimentId}`, "layout");
  return { ok: t.perfil.desat };
}

export async function arxivaArea(esdevenimentId: string, id: string): Promise<Resultat> {
  const { t } = await tradueix();
  const supabase = await createClient();
  const { error } = await supabase.from("arees").update({ activa: false }).eq("id", id);
  if (error) return { error: missatgeError(error, t) };
  revalidatePath(`/e/${esdevenimentId}`, "layout");
  return {};
}

// ------------------------------------------------------------------
// Perfil
// ------------------------------------------------------------------

export async function desaPerfil(_: Resultat, fd: FormData): Promise<Resultat> {
  const perfil = await requereixPerfil();
  const nom = text(fd, "nom");
  const idioma = text(fd, "idioma");
  const { t } = await tradueix();
  if (!nom) return { error: fmt(t.errors.obligatori, { camp: t.perfil.nom }) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("perfils")
    .update({ nom, idioma: esIdioma(idioma) ? idioma : perfil.idioma })
    .eq("id", perfil.id);
  if (error) return { error: missatgeError(error, t) };
  if (esIdioma(idioma)) (await cookies()).set(GALETA_IDIOMA, idioma, { path: "/", maxAge: 31536000 });
  revalidatePath("/", "layout");
  return { ok: "1" };
}

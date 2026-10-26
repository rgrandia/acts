"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GALETA_IDIOMA, tradueix } from "@/i18n";
import { fmt } from "@/i18n/format";
import { recordaIdioma } from "./idioma";

export type EstatLogin = { pas: "correu" | "codi"; email?: string; error?: string };

// Pas 1: demana un correu d'accés. Si el correu no té compte, Supabase el
// crea, però el hook "before user created" (migració 0001) ho rebutja si no
// hi ha cap invitació: no hi ha registre obert.
// Pas 2: o bé s'escriu el codi (si la plantilla de correu el porta), o bé
// s'obre l'enllaç del correu, que acaba a /auth/callback (vegeu route.ts).
export async function accioLogin(prev: EstatLogin, fd: FormData): Promise<EstatLogin> {
  const { t } = await tradueix();
  const supabase = await createClient();
  const email = String(fd.get("email") ?? prev.email ?? "").trim().toLowerCase();
  if (!email) return { pas: "correu", error: fmt(t.errors.obligatori, { camp: t.login.correu }) };

  if (fd.get("torna")) return { pas: "correu", email };

  if (prev.pas === "correu") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${await origen()}/auth/callback` },
    });
    if (error) {
      console.error("otp:", error.code, error.status, error.message);
      return { pas: "correu", email, error: missatge(error.code, error.status, t) };
    }
    return { pas: "codi", email };
  }

  const token = String(fd.get("codi") ?? "").replace(/\s/g, "");
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) {
    return { pas: "codi", email, error: error ? missatge(error.code, error.status, t, true) : t.login.errCodi };
  }

  await recordaIdioma(data.user.id);
  redirect("/");
}

// URL pública de l'app tal com l'ha vista el navegador (Vercel posa
// x-forwarded-host). Supabase només hi redirigeix si és a la llista d'URL
// permeses; si no, cau a la Site URL i el proxy recull el codi igualment.
async function origen(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

function missatge(
  code: string | undefined,
  status: number | undefined,
  t: Awaited<ReturnType<typeof tradueix>>["t"],
  verificant = false,
): string {
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit") return t.login.errMassaIntents;
  if (verificant && (code === "otp_expired" || code === "invalid_credentials" || status === 403)) return t.login.errCodi;
  // El hook respon 403; segons la versió de Supabase arriba amb un codi o un altre.
  if (status === 403 || status === 422 || code === "signup_disabled" || code?.startsWith("hook")) {
    return t.login.errNoConvidat;
  }
  return fmt(t.login.errGeneric, { codi: code ?? String(status ?? "?") });
}

export async function tancaSessio() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Idioma a la pantalla de login (sense sessió encara).
export async function canviaIdiomaGaleta(idioma: "ca" | "es") {
  (await cookies()).set(GALETA_IDIOMA, idioma, { path: "/", maxAge: 31536000 });
}

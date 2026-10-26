import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordaIdioma } from "@/lib/auth/idioma";

// Retorn de l'enllaç del correu d'accés. Supabase hi afegeix ?code=… (flux
// PKCE): es bescanvia per una sessió amb el verificador que el navegador va
// desar en demanar el correu. Per això l'enllaç s'ha d'obrir al mateix
// navegador; si no, es pot escriure el codi.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await recordaIdioma(data.user.id);
      return NextResponse.redirect(desti(request, "/"));
    }
    console.error("enllaç:", error?.code, error?.message);
  }
  return NextResponse.redirect(desti(request, "/login?error=enllac"));
}

// Al mateix host que ha fet servir el navegador (la galeta de sessió hi va
// lligada). request.url pot dur el host intern del servidor.
function desti(request: NextRequest, ruta: string): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return new URL(ruta, host ? `${proto}://${host}` : request.url);
}

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { RUTES_PUBLIQUES } from "./config";
import { supabaseClau, supabaseUrl } from "@/lib/supabase/config";

// Refresca la sessió de Supabase a cada petició i envia a /login qui no
// n'hagi iniciat. No decideix què pot veure ningú: això ho fa l'RLS.
export async function actualitzaSessio(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl(),
    supabaseClau(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const autenticat = Boolean(data?.claims?.sub);
  const ruta = request.nextUrl.pathname;

  // Si la URL de retorn no és a la llista permesa de Supabase, l'enllaç del
  // correu acaba a la Site URL amb ?code=…: l'enviem on toca.
  const codi = request.nextUrl.searchParams.get("code");
  if (codi && ruta !== "/auth/callback") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = `?code=${encodeURIComponent(codi)}`;
    return NextResponse.redirect(url);
  }
  const publica = RUTES_PUBLIQUES.some((r) => ruta === r || ruta.startsWith(r + "/"));

  if (!autenticat && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { elMeuRol } from "@/lib/auth/session";
import { tradueix } from "@/i18n";
import { COLORS_ZONES } from "@/lib/seating/model.ts";
import { Editor } from "@/components/seating/Editor";

export const dynamic = "force-dynamic";

export default async function PaginaPlanol({ params }: { params: Promise<{ id: string; planolId: string }> }) {
  const { id, planolId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(planolId)) notFound();
  const supabase = await createClient();
  const [rol, { t, idioma }, { data: planol }, { data: arribades }] = await Promise.all([
    elMeuRol(id),
    tradueix(),
    supabase
      .from("planols")
      .select("id, nom, dades, versio")
      .eq("id", planolId)
      .eq("esdeveniment_id", id)
      .eq("actiu", true)
      .maybeSingle(),
    supabase.from("arribades").select("persona").eq("planol_id", planolId).eq("arribat", true),
  ]);
  if (!planol || !rol) notFound();

  const zones = (Object.keys(COLORS_ZONES) as (keyof typeof COLORS_ZONES)[]).map((z) => ({
    id: z,
    name: t.seating.zones[z],
    color: COLORS_ZONES[z],
  }));

  return (
    <Editor
      key={planol.id}
      planolId={planol.id}
      esdevenimentId={id}
      inicial={planol.dades}
      versioInicial={planol.versio}
      arribadesInicials={(arribades ?? []).map((a) => a.persona)}
      esSuper={rol === "superusuari"}
      t={t.seating}
      locale={idioma === "ca" ? "ca-ES" : "es-ES"}
      zonesPerDefecte={zones}
    />
  );
}

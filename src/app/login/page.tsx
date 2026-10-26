import { redirect } from "next/navigation";
import { obteSessio } from "@/lib/auth/session";
import { tradueix } from "@/i18n";
import { FormulariLogin } from "./FormulariLogin";
import { SelectorIdiomaLogin } from "@/components/SelectorIdiomaLogin";

export const dynamic = "force-dynamic";

export default async function Login() {
  const sessio = await obteSessio();
  if (sessio?.perfil) redirect("/");
  const { t, idioma } = await tradueix();

  return (
    <main className="min-h-dvh grid place-items-center p-4">
      <div className="panell w-full max-w-sm p-6 grid gap-5">
        <div>
          <div className="marca text-2xl">{t.app.nom}</div>
          <div className="suau petit">{t.app.lema}</div>
        </div>
        <h1 className="text-lg font-semibold">{t.login.titol}</h1>
        <FormulariLogin t={t.login} />
        <SelectorIdiomaLogin actual={idioma} />
      </div>
    </main>
  );
}

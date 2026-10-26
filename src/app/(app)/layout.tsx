import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { requereixPerfil } from "@/lib/auth/session";
import { tancaSessio } from "@/lib/auth/actions";
import { tradueix } from "@/i18n";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requereixPerfil();
  const { t } = await tradueix();

  return (
    <div className="min-h-dvh">
      <header style={{ background: "var(--cap)" }} className="text-white">
        <div className="mx-auto max-w-5xl px-4 h-12 flex items-center gap-4">
          <Link href="/" className="marca text-lg">{t.app.nom}</Link>
          <span className="flex-1" />
          <Link href="/perfil" className="flex items-center gap-1.5 text-sm opacity-90 hover:opacity-100">
            <UserRound size={16} aria-hidden />
            <span className="hidden sm:inline">{perfil.nom}</span>
          </Link>
          <form action={tancaSessio}>
            <button className="flex items-center opacity-80 hover:opacity-100" title={t.nav.sortir} aria-label={t.nav.sortir}>
              <LogOut size={16} aria-hidden />
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

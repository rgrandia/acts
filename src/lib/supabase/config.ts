// Connexió a Supabase. Noms propis (ACTS_*) i només al servidor, a propòsit:
// la integració de Supabase de Vercel injecta NEXT_PUBLIC_SUPABASE_* que
// poden apuntar a un altre projecte. Aquestes es llegeixen en temps
// d'execució i el navegador no les necessita: l'app només parla amb
// Supabase des del servidor.

export function supabaseUrl(): string {
  const v = process.env.ACTS_SUPABASE_URL;
  if (!v) throw new Error("Falta la variable ACTS_SUPABASE_URL (vegeu .env.example).");
  return v;
}

export function supabaseClau(): string {
  const v = process.env.ACTS_SUPABASE_ANON_KEY;
  if (!v) throw new Error("Falta la variable ACTS_SUPABASE_ANON_KEY (vegeu .env.example).");
  return v;
}

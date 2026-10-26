# acts

Gestió d'esdeveniments amb equips, rols per esdeveniment i tasques. Català i
castellà. Projecte personal. L'especificació és a [`CLAUDE.md`](CLAUDE.md).

## Posar-ho en marxa

### 1. Supabase (regió europea)

1. Crea el projecte i aplica les migracions, en ordre:
   `DATABASE_URL=postgres://... scripts/aplica-migracions.sh`
   (o enganxa `supabase/migrations/*.sql` a l'editor SQL).
2. **Authentication → Hooks → Before User Created** → Postgres →
   `public.hook_abans_crear_usuari`. Sense això, qualsevol pot crear-se un
   compte (no veuria res, però ocuparia lloc).
3. **Authentication → URL Configuration**: *Site URL* = l'URL de l'app a
   Vercel; a *Redirect URLs*, afegeix `https://<la-teva-app>/auth/callback`.
   Amb això ja es pot entrar amb l'enllaç del correu (al mateix navegador).
   Recomanat: a *Emails → Templates* (*Confirm signup* i *Magic Link*),
   afegeix el codi, p. ex. `<p>Codi: <b>{{ .Token }}</b></p>`, per a qui
   obre el correu en un altre aparell.
4. **Authentication → Emails → SMTP**: configura un SMTP propi (Resend,
   Brevo...). El de Supabase n'envia massa pocs per a un esdeveniment real.
5. **Entra tu primer** (vegeu el pas 3 de Vercel): el primer compte de la
   plataforma en queda propietari.

### 2. Vercel

1. Importa el repositori.
2. Variables: `ACTS_SUPABASE_URL` i `ACTS_SUPABASE_ANON_KEY` (la clau
   pública). **No hi posis la `service_role`.**
3. Desplega i entra amb el teu correu abans de compartir l'URL.

### En local

```bash
cp .env.example .env.local   # i omple-ho
npm install
npm run dev
```

## Proves

```bash
npm run lint && npm run typecheck && npm run test:i18n
PGHOST=... PGUSER=postgres PGPASSWORD=... npm run test:sql
# punta a punta: vegeu .github/workflows/ci.yml (job e2e)
```

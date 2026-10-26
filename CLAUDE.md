# CLAUDE.md — acts: gestió d'esdeveniments

Especificació de referència. Qualsevol decisió que la contradigui s'ha de
consultar abans d'implementar-la.

---

## 1. Què és

**Projecte personal** de Roc. No té relació amb GESOP ni amb cap altra
empresa: ni marca, ni dades, ni infraestructura compartides.

Eina per organitzar esdeveniments amb un equip: qui fa què, per quan, i
on és cadascú. Ha d'aguantar un esdeveniment gran com el **CMUDE Barcelona**
(campionat mundial universitari de debat en espanyol): desenes de persones a
l'organització, diverses àrees i, més endavant, centenars d'assistents.

Antecedent: un `seating.html` d'un sol fitxer (plànols d'acte amb modes
Muntatge / Assignació / Acte, ordre de protocol i control d'arribades). La
idea és integrar-lo aquí (fase 2), no reescriure'l des de zero: la
geometria i l'ordre de protocol ja funcionen.

## 2. Decisions preses (26/10/2026)

| Tema | Decisió |
|---|---|
| Rols | **Per esdeveniment.** Algú pot ser superusuari d'un acte i usuari d'un altre. A sobre, el **propietari de plataforma**: crea esdeveniments i és superusuari de tots. |
| Idioma | **Català i castellà** des del primer dia. Cap text de la interfície fora de `src/i18n/`. |
| Dades d'assistents | Fora de la fase 1; s'hi afegeixen amb el seating i les inscripcions. |
| Abast desitjat | Tasques i equips, seating, participants/inscripcions, programa/acreditació. Es fa **per fases** (secció 3). |

### Protecció de dades: no és tasca de l'assistent

Indicació del propietari (26/10/2026): el compliment de l'RGPD està
controlat per ell. **No plantegis ni bloquegis feina per temes de protecció
de dades** (dades d'assistents, categories especials, conservació...).
Les dades d'assistents (convidats del seating, inscrits) es poden modelar
quan toqui cada fase. Això no afecta la seguretat tècnica de la secció 4
(RLS, cap `service_role`, res no s'esborra), que continua sent obligatòria.

## 3. Fases

1. **Base (fet)**: esdeveniments, equip amb rols, invitacions, àrees,
   tasques amb data/hora límit, comentaris, "les meves tasques", ca/es.
2. **Seating (fet)**: plànols per esdeveniment a partir del `seating.html`
   (secció 5 bis), amb les persones convidades de cada acte.
3. **Participants i inscripcions** (delegacions, persones, allotjament).
4. **Programa i acreditació** (agenda per sales, check-in amb QR).

Cada fase s'ha de fer servir de debò en un acte petit abans de començar la
següent. Si una fase no s'utilitza, no se n'afegeix cap altra a sobre.

## 4. Stack

| Capa | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Base de dades i auth | Supabase (Postgres), **regió europea** |
| Desplegament | Vercel (`fra1`) |
| Estils | Tailwind CSS v4 + variables a `globals.css` (mode fosc pel sistema) |

L'app només parla amb Supabase **des del servidor**, amb la clau pública i
la sessió de l'usuari. Variables: `ACTS_SUPABASE_URL`, `ACTS_SUPABASE_ANON_KEY`
(noms propis perquè la integració de Vercel no les trepitgi).

### Seguretat — no negociable

- **RLS a totes les taules des del primer dia.** Cap taula sense polítiques.
- **La clau `service_role` no es fa servir enlloc.** Si cal una operació
  privilegiada, es fa amb una funció `security definer` a Postgres que
  comprova els permisos ella mateixa (com `convida_membre()`).
- `.env*` fora del repositori.
- **Res no s'esborra**: cap política ni privilegi de `delete`. Tasques →
  `cancellada`; membres → `actiu = false`; àrees → `activa = false`;
  invitacions → `cancellada_el`.

## 5. Model de dades i permisos (migració 0001)

| Taula | Què és |
|---|---|
| `perfils` | 1:1 amb `auth.users`, creat per trigger. `idioma`, `propietari`. |
| `esdeveniments` | nom, lloc, dates, estat (`preparacio`, `en_curs`, `tancat`, `cancellat`). |
| `membres` | (esdeveniment, perfil) amb `rol` (`superusuari`/`usuari`), `area_id`, `actiu`. |
| `invitacions` | correus sense compte encara; s'apliquen soles quan la persona entra. |
| `arees` | per esdeveniment (logística, acreditació...), amb color. |
| `tasques` | per esdeveniment; àrea, persona assignada, data i hora límit, prioritat, estat. `feta` ⇔ `feta_el` no nul. |
| `comentaris` | append-only, per tasca. |

Funcions de permisos: `es_propietari()`, `es_membre(esd)`, `es_super(esd)`.

| Qui | Pot |
|---|---|
| Propietari | Crear esdeveniments. És superusuari de tots. |
| Superusuari d'un acte | Editar-lo, convidar i treure gent, canviar rols, crear àrees, crear/editar/assignar tasques. |
| Usuari d'un acte | Veure l'acte, l'equip i les tasques; canviar l'**estat** de les que té assignades; comentar. |
| Qualsevol altre | Res. Un esdeveniment del qual no és membre no existeix per a ell (404). |

Regles que fan complir triggers (no l'app):

- Un esdeveniment no es pot quedar sense cap superusuari actiu.
- Només s'assigna a membres actius de l'esdeveniment.
- Qui no és superusuari només canvia l'estat de la tasca, mai títol, data,
  persona, àrea ni prioritat.

## 5 bis. Seating (migració 0002)

| Taula | Què és |
|---|---|
| `planols` | Un plànol per acte o sala. `dades` és el document de l'antic `seating.html` (v:1: elements, seients, zones i convidats) en jsonb; `versio` puja a cada canvi de contingut. |
| `planols_historial` | Còpia anterior en desar, com a molt una cada 15 minuts. Append-only. |
| `arribades` | Qui ha arribat el dia de l'acte, per persona del plànol. Fora del document perquè la marquen diverses persones alhora. |

- **Lògica** a `src/lib/seating/` (geometria, ordre de protocol, CSV),
  portada de l'original sense canviar-ne el comportament, amb proves
  (`npm run test:seating`). Si es toca l'ordre de protocol, primer la prova.
  Regla: la dreta de qui presideix és l'esquerra del públic.
- **Editor** a `src/components/seating/`. El document viu en un `Magatzem`
  fora de React i només es modifica amb `muta()`, que apunta l'estat per
  desfer i programa el desat automàtic (1,5 s).
- **Concurrència**: `desa_planol(id, dades, versio)` només desa si ningú no
  ho ha fet des d'aquella versió; si no, l'editor avisa i ofereix baixar els
  canvis propis i carregar la versió nova. Mai no es trepitja en silenci.
- **Permisos**: superusuari → muntatge, assignació i acte; usuari → només
  mode acte (consultar i marcar arribades). En mode acte les arribades es
  tornen a llegir cada 10 s.
- Importa els `.json` de l'eina antiga (botó d'importar) i exporta PNG,
  plànol imprès, etiquetes, llista de porta, CSV i JSON.
- Les zones per defecte neixen en l'idioma de qui crea el plànol; després
  són dades editables, no textos de la interfície.

## 6. Autenticació

Correu d'accés de Supabase (OTP), sense contrasenyes ni registre obert. El
correu serveix de dues maneres:

- **Enllaç**: porta a `/auth/callback?code=…` (flux PKCE) i s'ha d'obrir
  al mateix navegador on s'ha demanat. Funciona amb les plantilles per
  defecte de Supabase. Si la URL de retorn no és a la llista permesa,
  Supabase torna a la Site URL i el proxy hi recull el `code`.
- **Codi**: s'escriu a la pantalla d'entrada. Cal `{{ .Token }}` a les
  plantilles; és el que fa servir qui obre el correu en un altre aparell.

A més:

- El hook **Before User Created** (`public.hook_abans_crear_usuari`) només
  deixa crear comptes als correus amb una invitació pendent.
- **Arrencada**: el primer compte que es crea a la plataforma en queda
  propietari. Per tant, **el primer que ha d'entrar és el propietari**, just
  després d'aplicar la migració i abans de publicar l'URL.
- L'app no envia correus d'invitació: qui convida avisa la persona.

Configuració a Supabase (vegeu `README.md`): Site URL = URL de l'app,
activar el hook, `{{ .Token }}` a les plantilles (opcional però
recomanat) i un SMTP propi. L'SMTP
per defecte de Supabase envia molt pocs correus per hora: n'hi ha prou per
provar-ho, però no per a un esdeveniment real.

Tot el que és d'autenticació viu a `src/lib/auth/`; canviar de mètode no ha
de tocar res més.

## 7. Idiomes

- `src/i18n/ca.ts` és la referència; `es.ts` té el tipus `Diccionari` i
  ha de tenir les mateixes claus i variables (`npm run test:i18n`).
- Idioma: perfil → galeta (`acts_idioma`) → navegador.
- Els noms del codi i de la base de dades són en català.

## 8. Proves

- `npm run test:sql` — migracions en un Postgres buit + `supabase/tests/verificacio.sql`
  (permisos de cada rol, hook, invitacions, últim superusuari, cap delete).
- `npm run test:i18n`.
- `npm run test:seating` — geometria, ordre de protocol, CSV.
- `e2e/flux.mjs` — navegador real contra `scripts/e2e/entorn.sh`
  (Postgres + GoTrue + PostgREST + SMTP de joguina). Cobreix el codi i
  l'enllaç del correu, el hook,
  l'arrencada del propietari, invitar, assignar, marcar feta, comentar i
  canviar d'idioma.
- `e2e/seating.mjs` (després de `flux.mjs`) — crear plànol, assignació per
  protocol, desat i persistència, arribades des del mòbil (en castellà) i
  conflicte entre dues pestanyes.

Qui afegeixi un permís nou, l'afegeix a `verificacio.sql`.

## 9. Migracions

`supabase/migrations/AAAAMMDDhhmmss_nom.sql`, aplicades per
`scripts/aplica-migracions.sh` i registrades a `migracions_aplicades`.
Mai no s'edita una migració ja aplicada a producció: se'n fa una de nova.

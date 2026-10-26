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
| Dades d'assistents | **Ara no.** Només l'equip (organització i voluntariat). |
| Abast desitjat | Tasques i equips, seating, participants/inscripcions, programa/acreditació. Es fa **per fases** (secció 3). |

### Contradicció pendent de resoldre (abans de la fase 2)

"Només l'equip" és incompatible amb el seating i amb les inscripcions:

- El seating assigna seients a **persones convidades** (nom, càrrec, entitat):
  dades personals de tercers que no són de l'equip.
- Les inscripcions d'un CMUDE són centenars de persones de diversos països.
  Si s'hi afegeixen dietes o al·lèrgies, són **dades de salut** (art. 9 RGPD).

Cal decidir, abans de la fase 2: quines dades d'assistents es desen, qui hi
té accés (rol nou?), quant de temps s'hi guarden i qui n'és el responsable
del tractament (tu o l'organització de l'esdeveniment). Mentre no es decideixi,
no s'hi crea cap taula de persones externes a l'equip.

## 3. Fases

1. **Base (fet)**: esdeveniments, equip amb rols, invitacions, àrees,
   tasques amb data/hora límit, comentaris, "les meves tasques", ca/es.
2. **Seating**: sales i plànols per esdeveniment, a partir del
   `seating.html`. Depèn de la decisió de la secció 2.
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

## 6. Autenticació

Codi d'un sol ús per correu (OTP de Supabase). Sense contrasenyes ni
registre obert:

- El hook **Before User Created** (`public.hook_abans_crear_usuari`) només
  deixa crear comptes als correus amb una invitació pendent.
- **Arrencada**: el primer compte que es crea a la plataforma en queda
  propietari. Per tant, **el primer que ha d'entrar és el propietari**, just
  després d'aplicar la migració i abans de publicar l'URL.
- L'app no envia correus d'invitació: qui convida avisa la persona.

Configuració necessària a Supabase (vegeu `README.md`): activar el hook,
posar `{{ .Token }}` a les plantilles de correu i un SMTP propi. L'SMTP
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
- `e2e/flux.mjs` — navegador real contra `scripts/e2e/entorn.sh`
  (Postgres + GoTrue + PostgREST + SMTP de joguina). Cobreix l'OTP, el hook,
  l'arrencada del propietari, invitar, assignar, marcar feta, comentar i
  canviar d'idioma.

Qui afegeixi un permís nou, l'afegeix a `verificacio.sql`.

## 9. Migracions

`supabase/migrations/AAAAMMDDhhmmss_nom.sql`, aplicades per
`scripts/aplica-migracions.sh` i registrades a `migracions_aplicades`.
Mai no s'edita una migració ja aplicada a producció: se'n fa una de nova.

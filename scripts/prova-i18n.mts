// Comprova que tots els idiomes tenen les mateixes claus que el català i
// les mateixes variables {x} a cada text. El tipus ja ho exigeix en compilar;
// això ho repeteix sense TypeScript i, a més, mira les variables.
import { ca } from "../src/i18n/ca.ts";
import { es } from "../src/i18n/es.ts";

type Arbre = { [k: string]: string | Arbre };
const errors: string[] = [];

function vars(s: string): string {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
}

function compara(ref: Arbre, altre: Arbre, cami: string, nom: string) {
  for (const k of Object.keys(ref)) {
    const a = ref[k];
    const b = altre[k];
    const c = cami ? `${cami}.${k}` : k;
    if (b === undefined) errors.push(`${nom}: falta ${c}`);
    else if (typeof a === "string") {
      if (typeof b !== "string") errors.push(`${nom}: ${c} hauria de ser text`);
      else if (vars(a) !== vars(b)) errors.push(`${nom}: ${c} té variables diferents`);
      else if (!b.trim()) errors.push(`${nom}: ${c} és buit`);
    } else if (typeof b === "string") errors.push(`${nom}: ${c} hauria de ser un grup`);
    else compara(a, b, c, nom);
  }
  for (const k of Object.keys(altre)) if (!(k in ref)) errors.push(`${nom}: sobra ${cami ? cami + "." : ""}${k}`);
}

compara(ca as Arbre, es as Arbre, "", "es");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("i18n: ca i es coincideixen");

// El document del plànol viu fora de React (com a l'eina original, es
// modifica in situ) i avisa els components quan canvia. Els components el
// llegeixen amb useSyncExternalStore i el modifiquen només amb muta().

import type { Planol } from "@/lib/seating/model.ts";

export class Magatzem {
  S: Planol;
  private versio = 0;
  private subs = new Set<() => void>();

  constructor(S: Planol) {
    this.S = S;
  }

  subscriu = (f: () => void) => {
    this.subs.add(f);
    return () => {
      this.subs.delete(f);
    };
  };

  llegeix = () => this.versio;

  muta(f: (S: Planol) => void) {
    f(this.S);
    this.versio++;
    this.subs.forEach((s) => s());
  }

  substitueix(S: Planol) {
    this.muta(() => {
      this.S = S;
    });
  }
}

// Espill de l'esquema (supabase/migrations). Si canvia una columna, canvia aquí.

export type Rol = "superusuari" | "usuari";
export type EstatEsdeveniment = "preparacio" | "en_curs" | "tancat" | "cancellat";
export type EstatTasca = "pendent" | "en_curs" | "feta" | "cancellada";
export type Prioritat = "alta" | "normal" | "baixa";

export const ROLS: Rol[] = ["superusuari", "usuari"];
export const ESTATS_ESDEVENIMENT: EstatEsdeveniment[] = ["preparacio", "en_curs", "tancat", "cancellat"];
export const ESTATS_TASCA: EstatTasca[] = ["pendent", "en_curs", "feta", "cancellada"];
export const PRIORITATS: Prioritat[] = ["alta", "normal", "baixa"];

export type Perfil = {
  id: string;
  nom: string;
  email: string;
  idioma: "ca" | "es";
  propietari: boolean;
};

export type Esdeveniment = {
  id: string;
  nom: string;
  descripcio: string | null;
  lloc: string | null;
  data_inici: string | null;
  data_fi: string | null;
  estat: EstatEsdeveniment;
};

export type Area = { id: string; nom: string; color: string; activa: boolean };

export type Membre = {
  perfil_id: string;
  rol: Rol;
  area_id: string | null;
  actiu: boolean;
};

export type Tasca = {
  id: string;
  esdeveniment_id: string;
  area_id: string | null;
  titol: string;
  descripcio: string | null;
  assignada_a: string | null;
  data_limit: string | null;
  hora_limit: string | null;
  estat: EstatTasca;
  prioritat: Prioritat;
  feta_el: string | null;
  creada_per: string | null;
  creat_el: string;
};

export const COLUMNES_TASCA =
  "id, esdeveniment_id, area_id, titol, descripcio, assignada_a, data_limit, hora_limit, estat, prioritat, feta_el, creada_per, creat_el";

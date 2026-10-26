// Únic lloc que sap com s'entra a l'app. Ara: codi d'un sol ús per correu
// (Supabase OTP). Canviar de mètode (contrasenya, Google, Entra ID) no ha de
// tocar res fora de src/lib/auth i de la pantalla de login.
export const RUTES_PUBLIQUES = ["/login", "/auth"];

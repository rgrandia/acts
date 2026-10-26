// Utilitats compartides de les proves de punta a punta.
import fs from "node:fs";

export const URL = process.env.E2E_URL ?? "http://127.0.0.1:3000";
const DIR = process.env.E2E_DIR ?? "/tmp/acts-e2e";
const CAPTURES = process.env.E2E_CAPTURES;
if (CAPTURES) fs.mkdirSync(CAPTURES, { recursive: true });

// Quants correus ha rebut una adreça.
export function nCorreus(email) {
  return fs
    .readFileSync(`${DIR}/correus.txt`, "utf8")
    .split("=====FI=====")
    .filter((b) => new RegExp(`^To: .*${email}`, "mi").test(b)).length;
}

// Espera que arribi un correu nou (el codi o l'enllaç d'abans ja no valen).
export async function esperaCorreu(email, abans) {
  for (let i = 0; i < 100; i++) {
    if (nCorreus(email) > abans) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no arriba cap correu nou per a ${email}`);
}

// Darrer codi enviat a una adreça.
export function codi(email) {
  const blocs = fs.readFileSync(`${DIR}/correus.txt`, "utf8").split("=====FI=====");
  for (const b of blocs.reverse()) {
    if (!new RegExp(`^To: .*${email}`, "mi").test(b)) continue;
    const m = b.replace(/=\r?\n/g, "").match(/code: (\d{6})/);
    if (m) return m[1];
  }
  throw new Error(`cap codi per a ${email}`);
}

export async function captura(page, nom) {
  if (CAPTURES) await page.screenshot({ path: `${CAPTURES}/${nom}.png`, fullPage: true });
}

export async function entra(navegador, email, { mobil = false } = {}) {
  const ctx = await navegador.newContext({
    locale: "ca-ES",
    viewport: mobil ? { width: 390, height: 844 } : { width: 1280, height: 860 },
  });
  const page = await ctx.newPage();
  await page.goto(`${URL}/login`);
  await page.getByLabel("Correu electrònic").fill(email);
  const abans = nCorreus(email);
  await page.getByRole("button", { name: "Envia'm un codi" }).click();
  // GoTrue no deixa demanar dos correus seguits per a la mateixa adreça: si
  // l'app diu "massa intents", s'espera i es torna a provar.
  const codi_ = page.getByLabel("Codi del correu");
  const massa = page.getByText("Massa intents seguits");
  await codi_.or(massa).waitFor();
  if (await massa.isVisible()) {
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Envia'm un codi" }).click();
  }
  await codi_.waitFor();
  await esperaCorreu(email, abans);
  await page.getByLabel("Codi del correu").fill(codi(email));
  await page.getByRole("button", { name: "Entra", exact: true }).click();
  await page.waitForURL(`${URL}/`);
  return page;
}


// Darrer enllaç d'accés enviat a una adreça (el correu ve en quoted-printable).
export function enllac(email) {
  const blocs = fs.readFileSync(`${DIR}/correus.txt`, "utf8").split("=====FI=====");
  for (const b of blocs.reverse()) {
    if (!new RegExp(`^To: .*${email}`, "mi").test(b)) continue;
    const net = b.replace(/=\r?\n/g, "").replace(/=3D/g, "=");
    const m = net.match(/href="([^"]+\/verify\?[^"]+)"/);
    if (m) return m[1].replace(/&amp;/g, "&");
  }
  throw new Error(`cap enllaç per a ${email}`);
}

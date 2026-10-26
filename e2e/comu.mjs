// Utilitats compartides de les proves de punta a punta.
import fs from "node:fs";

export const URL = process.env.E2E_URL ?? "http://127.0.0.1:3000";
const DIR = process.env.E2E_DIR ?? "/tmp/acts-e2e";
const CAPTURES = process.env.E2E_CAPTURES;
if (CAPTURES) fs.mkdirSync(CAPTURES, { recursive: true });

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
  await page.getByRole("button", { name: "Envia'm un codi" }).click();
  await page.getByLabel("Codi del correu").waitFor();
  await page.getByLabel("Codi del correu").fill(codi(email));
  await page.getByRole("button", { name: "Entra", exact: true }).click();
  await page.waitForURL(`${URL}/`);
  return page;
}


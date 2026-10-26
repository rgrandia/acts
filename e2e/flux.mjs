// Prova de punta a punta del flux bàsic, amb un navegador real contra
// l'entorn de scripts/e2e/entorn.sh i l'app a http://127.0.0.1:3000.
//   E2E_DIR: on hi ha correus.txt (el servidor SMTP de joguina)
//   E2E_CAPTURES: si hi és, hi desa captures de pantalla
import assert from "node:assert/strict";
import { chromium } from "playwright";

import { URL, captura, enllac, entra, esperaCorreu, nCorreus } from "./comu.mjs";

const navegador = await chromium.launch();
try {
  // 1. La propietària és el primer usuari de la plataforma (arrencada).
  const prop = await entra(navegador, "prop@prova.test");
  // 2. Un cop hi ha propietari, qui no està convidat no pot entrar.
  {
    const page = await (await navegador.newContext({ locale: "ca-ES" })).newPage();
    await page.goto(`${URL}/login`);
    await page.getByLabel("Correu electrònic").fill("intrus@prova.test");
    await page.getByRole("button", { name: "Envia'm un codi" }).click();
    await page.getByText("Aquest correu no té cap invitació").waitFor();
    await captura(page, "01-login-rebutjat");
  }

  await prop.getByRole("link", { name: "Nou esdeveniment" }).click();
  await prop.getByLabel("Nom").fill("CMUDE Barcelona 2027");
  await prop.getByLabel("Lloc").fill("Barcelona");
  await prop.getByLabel("Inici").fill("2027-07-10");
  await prop.getByLabel("Fi").fill("2027-07-17");
  await prop.getByRole("button", { name: "Crea l'esdeveniment" }).click();
  await prop.waitForURL(/\/e\/[0-9a-f-]{36}$/);
  const urlEsd = prop.url();
  await prop.getByText("Hi ets com a").waitFor();

  // 3. Àrea i invitació.
  await prop.getByRole("link", { name: "Equip" }).click();
  await prop.getByLabel("Nom de l'àrea").fill("Acreditació");
  await prop.getByRole("button", { name: "Afegeix" }).click();
  await prop.locator("aside").getByText("Acreditació", { exact: true }).waitFor();
  await prop.getByLabel("Correu", { exact: true }).fill("Vol@prova.test");
  await prop.getByRole("button", { name: "Convida", exact: true }).click();
  await prop.getByText("Invitació desada").waitFor();
  await prop.getByText("vol@prova.test").waitFor();
  await prop.getByText("prop@prova.test").waitFor(); // la llista de membres
  await captura(prop, "02-equip");

  // 4. La voluntària entra (des del mòbil) i ja és a l'equip.
  const vol = await entra(navegador, "vol@prova.test", { mobil: true });
  await vol.getByRole("link", { name: /CMUDE Barcelona 2027/ }).waitFor();
  assert.equal(await vol.getByRole("link", { name: "Nou esdeveniment" }).count(), 0);

  // 5. La propietària li assigna una tasca.
  await prop.goto(urlEsd);
  await prop.getByText("Nova tasca").click();
  const nova = prop.locator("details", { hasText: "Nova tasca" });
  await nova.getByLabel("Títol").fill("Imprimir acreditacions");
  await nova.getByLabel("Assignada a").selectOption({ label: "vol" });
  await nova.getByLabel("Àrea").selectOption({ label: "Acreditació" });
  await nova.getByLabel("Data límit").fill("2027-07-09");
  await nova.getByRole("button", { name: "Crea la tasca" }).click();
  await prop.getByRole("link", { name: "Imprimir acreditacions" }).waitFor();
  await captura(prop, "03-tasques");

  // 6. La voluntària la veu a l'inici, la marca feta i comenta.
  await vol.reload();
  await vol.getByRole("link", { name: "Imprimir acreditacions" }).waitFor();
  await captura(vol, "04-inici-mobil");
  await vol.getByRole("button", { name: "Feta" }).first().click();
  await vol.getByText("No tens cap tasca oberta.").waitFor();
  await vol.goto(urlEsd + "?f=tancades");
  await vol.getByRole("link", { name: "Imprimir acreditacions" }).click();
  await vol.getByText("Pots canviar-ne l'estat").waitFor();
  assert.equal(await vol.getByText("Edita la tasca").count(), 0);
  await vol.getByLabel("Comentaris").fill("Fetes, són a recepció");
  await vol.getByRole("button", { name: "Comenta" }).click();
  await vol.getByText("Fetes, són a recepció").waitFor();

  // 7. Una usuària no pot crear esdeveniments.
  const r = await vol.goto(`${URL}/esdeveniments/nou`);
  assert.equal(r.status(), 404);

  // 8. Canvi d'idioma al perfil.
  await vol.goto(`${URL}/perfil`);
  await vol.getByLabel("Idioma").selectOption("es");
  await vol.getByRole("button", { name: "Desa" }).click();
  await vol.getByText("Mi perfil").waitFor();
  await vol.goto(`${URL}/`);
  await vol.getByText("Mis tareas").waitFor();

  // 9. Qui no és de l'esdeveniment no el veu (404).
  await prop.goto(`${URL}/e/00000000-0000-0000-0000-000000000000`);
  await prop.getByText("404").waitFor();

  // 10. També s'entra amb l'enllaç del correu (sense escriure el codi), al
  //     mateix navegador on s'ha demanat.
  {
    const page = await (await navegador.newContext({ locale: "ca-ES" })).newPage();
    await page.goto(`${URL}/login`);
    await page.getByLabel("Correu electrònic").fill("prop@prova.test");
    const abans = nCorreus("prop@prova.test");
    await page.getByRole("button", { name: "Envia'm un codi" }).click();
    await page.getByLabel("Codi del correu").waitFor();
    await esperaCorreu("prop@prova.test", abans);
    await page.goto(enllac("prop@prova.test"));
    await page.waitForURL(`${URL}/`);
    await page.getByRole("link", { name: "Nou esdeveniment" }).waitFor();
    // Un enllaç ja fet servir no torna a obrir sessió.
    const altre = await (await navegador.newContext({ locale: "ca-ES" })).newPage();
    await altre.goto(`${URL}/auth/callback?code=fals`);
    await altre.getByText("L'enllaç no és vàlid o ha caducat").waitFor();
  }

  console.log("e2e: tot correcte");
} finally {
  await navegador.close();
}

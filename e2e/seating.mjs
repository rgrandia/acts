// Prova de punta a punta del seating. S'executa DESPRÉS de flux.mjs (en fa
// servir l'esdeveniment, la propietària i la voluntària).
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { captura, entra } from "./comu.mjs";

// El desat és automàtic (1,5 s després de l'últim canvi): espera que passi
// de "canvis sense desar" a "desat".
async function esperaDesat(page) {
  await page.locator(".st-flag-pendent, .st-flag-desant").waitFor();
  await page.locator(".st-flag-desat").waitFor({ timeout: 10000 });
}

const navegador = await chromium.launch();
try {
  // 1. La propietària crea un plànol.
  const prop = await entra(navegador, "prop@prova.test");
  await prop.getByRole("link", { name: /CMUDE Barcelona 2027/ }).click();
  await prop.getByRole("link", { name: "Plànols" }).click();
  await prop.getByText("Encara no hi ha cap plànol.").waitFor();
  await prop.getByLabel("Nom del plànol").fill("Cerimònia inaugural");
  await prop.getByRole("button", { name: "Crea el plànol" }).click();
  await prop.waitForURL(/\/planols\/[0-9a-f-]{36}$/);
  const urlPlanol = prop.url();

  // 2. Muntatge: una presidència de 5.
  await prop.getByRole("button", { name: "Presidència", exact: true }).click();
  await prop.locator('[data-seat$=":4"]').waitFor();
  assert.equal(await prop.locator("[data-seat]").count(), 5);

  // 3. Assignació: importa tres persones i col·loca-les per protocol.
  await prop.getByRole("button", { name: "Assignació" }).click();
  await prop.getByRole("button", { name: "Importa CSV" }).click();
  await prop.getByRole("dialog").locator("textarea").fill("nom;càrrec;ordre\nPresidenta;Rectora;1\nSegon;Vicerector;2\nTercera;Degana;3");
  await prop.getByRole("button", { name: "Importa", exact: true }).click();
  await prop.getByText("3 convidats importats").waitFor();
  await prop.getByRole("button", { name: "Assigna", exact: true }).click();
  await prop.getByText("3 persones col·locades").waitFor();
  // Protocol: centre (P3), dreta de qui presideix (P2), esquerra (P4).
  const seientDe = async (nom) =>
    (await prop.locator(".st-row", { hasText: nom }).locator(".st-seat").innerText()).trim();
  assert.equal(await seientDe("Presidenta"), "P3");
  assert.equal(await seientDe("Segon"), "P2");
  assert.equal(await seientDe("Tercera"), "P4");
  await esperaDesat(prop);
  await captura(prop, "05-seating-assignacio");

  // 4. Persisteix: en tornar-hi, hi és tot.
  await prop.reload();
  await prop.getByRole("button", { name: "Assignació" }).click();
  assert.equal(await seientDe("Presidenta"), "P3");

  // 5. La voluntària (mòbil; flux.mjs l'ha deixada en castellà) només hi té
  //    el mode acte i marca una arribada.
  const vol = await entra(navegador, "vol@prova.test", { mobil: true });
  await vol.goto(urlPlanol);
  await vol.getByText("Consulta: puedes marcar llegadas.").waitFor();
  assert.equal(await vol.getByRole("button", { name: "Montaje" }).count(), 0);
  await vol.getByRole("button", { name: "Panel" }).click();
  await vol.getByRole("button", { name: /Presidenta/ }).click();
  await vol.getByRole("button", { name: /✓ Presidenta/ }).waitFor();
  await vol.getByText("1 de 3 han llegado").waitFor();
  await vol.waitForTimeout(300); // que acabi la transició del panell
  await captura(vol, "06-seating-acte-mobil");
  // Tocar fora del panell el tanca.
  await vol.mouse.click(370, 400);
  await vol.locator(".seating:not(.side-on)").waitFor();
  // Ha quedat desat (no només a la pantalla).
  await vol.reload();
  await vol.getByRole("button", { name: "Panel" }).click();
  await vol.getByRole("button", { name: /✓ Presidenta/ }).waitFor();

  // 6. La propietària ho veu en mode acte (llegeix les arribades en entrar-hi).
  await prop.getByRole("button", { name: "Acte", exact: true }).click();
  await prop.getByText("1 de 3 han arribat").waitFor();

  // 7. Dues pestanyes editant alhora: la segona que desa rep el conflicte.
  const segona = await prop.context().newPage();
  await segona.goto(urlPlanol);
  await prop.getByRole("button", { name: "Muntatge" }).click();
  await prop.getByRole("button", { name: "Taula rodona" }).click();
  await esperaDesat(prop);
  await segona.getByRole("button", { name: "Taula rectangular" }).click();
  await segona.getByText("Algú altre ha desat aquest plànol mentrestant").waitFor({ timeout: 10000 });
  await segona.getByRole("button", { name: "Carrega la versió nova" }).click();
  await segona.locator(".st-nm", { hasText: /^Taula$/ }).waitFor();
  assert.equal(await segona.locator(".st-nm", { hasText: "Taula rect." }).count(), 0);

  // 8. Llista de plànols amb comptes.
  await prop.goto(urlPlanol.replace(/\/[0-9a-f-]{36}$/, ""));
  await prop.getByText(/13 seients · 3 convidats/).waitFor();

  console.log("e2e seating: tot correcte");
} finally {
  await navegador.close();
}

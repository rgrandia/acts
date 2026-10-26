// Servidor SMTP de joguina per a les proves: accepta qualsevol missatge i
// l'afegeix a $E2E_DIR/correus.txt. NOMÉS PER A PROVES LOCALS.
import net from "node:net";
import fs from "node:fs";

const fitxer = `${process.env.E2E_DIR ?? "/tmp/acts-e2e"}/correus.txt`;
net
  .createServer((s) => {
    let dades = false;
    let buffer = "";
    s.write("220 prova ESMTP\r\n");
    s.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (dades) {
        const fi = buffer.indexOf("\r\n.\r\n");
        if (fi < 0) return;
        fs.appendFileSync(fitxer, buffer.slice(0, fi) + "\n=====FI=====\n");
        buffer = buffer.slice(fi + 5);
        dades = false;
        s.write("250 OK\r\n");
      }
      let i;
      while (!dades && (i = buffer.indexOf("\r\n")) >= 0) {
        const linia = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        const ordre = linia.slice(0, 4).toUpperCase();
        if (ordre === "EHLO") s.write("250-prova\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (ordre === "HELO") s.write("250 prova\r\n");
        else if (ordre === "AUTH") s.write("235 OK\r\n");
        else if (ordre === "DATA") { dades = true; s.write("354 endavant\r\n"); }
        else if (ordre === "QUIT") { s.write("221 adeu\r\n"); s.end(); }
        else s.write("250 OK\r\n");
      }
    });
    s.on("error", () => {});
  })
  .listen(2525, "127.0.0.1");

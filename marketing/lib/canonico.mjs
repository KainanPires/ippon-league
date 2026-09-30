// marketing/lib/canonico.mjs
//
// JSON canónico (chaves ordenadas, sem espaços) e hash SHA-256.
// É a base de tudo o que é "vinculado": se um byte relevante mudar, o hash muda
// e a autorização deixa de servir.

import crypto from "node:crypto";
import fs from "node:fs";

export function canonico(valor) {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor);
  if (Array.isArray(valor)) return "[" + valor.map(canonico).join(",") + "]";
  const chaves = Object.keys(valor).filter((k) => valor[k] !== undefined).sort();
  return "{" + chaves.map((k) => JSON.stringify(k) + ":" + canonico(valor[k])).join(",") + "}";
}

export function sha256(texto) {
  return crypto.createHash("sha256").update(texto).digest("hex");
}

export function sha256Ficheiro(caminho) {
  return crypto.createHash("sha256").update(fs.readFileSync(caminho)).digest("hex");
}

export function hashCanonico(valor) {
  return sha256(canonico(valor));
}

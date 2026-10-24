/**
 * Modul: Secrets aus Dateien (Docker/Podman Secrets, Vault Agent, ...)
 * Zweck: Für jede Variable aus FILE_SECRET_VARS kann `<NAME>_FILE` auf eine
 *        Datei zeigen (z. B. /run/secrets/session_secret). Der Inhalt wird beim
 *        Start in `<NAME>` übernommen, damit das Secret nicht in der .env, in
 *        `docker inspect` oder im Compose-File stehen muss. Dieselbe Konvention
 *        wie bei den offiziellen postgres- und mysql-Images.
 *
 *        Regeln:
 *          - nur die Namen aus FILE_SECRET_VARS, keine beliebigen `*_FILE`
 *          - sind `<NAME>` und `<NAME>_FILE` beide gesetzt, bricht der Start ab:
 *            sonst entscheidet die Reihenfolge, welcher Wert gilt
 *          - eine fehlende, unlesbare oder leere Datei bricht den Start ab. Ein
 *            stiller Rückfall wäre bei DB_ENCRYPTION_KEY gefährlich: die App
 *            würde eine neue, unverschlüsselte Datenbank anlegen
 *          - nur Zeilenumbrüche am Ende werden entfernt, sonst nichts
 *          - der Wert wird nie geloggt, nur der Name der Variable
 */
import { readFileSync } from 'node:fs';

export const FILE_SECRET_VARS = Object.freeze([
  'SESSION_SECRET',
  'DB_ENCRYPTION_KEY',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_DRIVE_CLIENT_SECRET',
  'MS_CLIENT_SECRET',
  'OIDC_CLIENT_SECRET',
  'APPLE_APP_SPECIFIC_PASSWORD',
  'OPENWEATHER_API_KEY',
  'FIXER_API_KEY',
  'WEBDAV_BACKUP_PASSWORD',
  'DOCUMENT_STORAGE_WEBDAV_PASSWORD',
  'VAPID_PRIVATE_KEY',
  'EMAIL_SMTP_PASS',
  'IMMICH_API_KEY',
]);

/**
 * Übernimmt `<NAME>_FILE` nach `<NAME>` in `env`.
 *
 * @param {NodeJS.ProcessEnv} [env]  Ziel, Default process.env
 * @param {(path: string) => string} [read]  Dateileser, für Tests austauschbar
 * @returns {string[]} Namen der Variablen, die aus einer Datei kamen
 * @throws {Error} bei Konflikt, unlesbarer oder leerer Datei
 */
export function applyFileSecrets(env = process.env, read = (p) => readFileSync(p, 'utf8')) {
  const loaded = [];
  for (const name of FILE_SECRET_VARS) {
    const fileVar = `${name}_FILE`;
    const path = env[fileVar];
    if (path === undefined || path === '') continue;

    if (env[name] !== undefined && env[name] !== '') {
      throw new Error(`${name} and ${fileVar} are both set. Set only one of them.`);
    }

    let raw;
    try {
      raw = read(path);
    } catch (err) {
      throw new Error(`${fileVar} points to ${path}, which cannot be read (${err.code || err.message}).`);
    }

    const value = raw.replace(/[\r\n]+$/, '');
    if (value === '') {
      throw new Error(`${fileVar} points to ${path}, which is empty.`);
    }

    env[name] = value;
    loaded.push(name);
  }
  return loaded;
}

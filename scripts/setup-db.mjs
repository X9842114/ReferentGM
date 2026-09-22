import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 0) continue;
      const key = line.slice(0, i).trim();
      if (!key || process.env[key]) continue;
      process.env[key] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@127.0.0.1:5432/refgm";

function dbNameFromUrl(connectionString) {
  const url = new URL(connectionString);
  const name = decodeURIComponent(url.pathname.replace(/^\//, "") || "refgm");
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Nom de base invalide: ${name}`);
  }
  return name;
}

async function ensureDatabase() {
  const name = dbNameFromUrl(DATABASE_URL);
  const adminUrl = new URL(DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const found = await admin.query(
      "select 1 from pg_database where datname = $1",
      [name]
    );
    if (!found.rowCount) {
      await admin.query(`create database ${name}`);
      console.log(`Base créée: ${name}`);
    } else {
      console.log(`Base déjà là: ${name}`);
    }
  } finally {
    await admin.end();
  }
}

async function applySchema() {
  const sqlPath = path.join(root, "supabase", "refgm.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Schéma appliqué: supabase/refgm.sql");
  } finally {
    await client.end();
  }
}

try {
  await ensureDatabase();
  await applySchema();
  console.log("PostgreSQL RefGM prêt.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

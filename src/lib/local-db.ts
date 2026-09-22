import { Pool } from "pg";
import "server-only";
import {
  PERMISSION_FLAGS,
  SYSTEM_GRADE_DEFS,
} from "@/lib/grade-registry";

export const LOCAL_TABLES = [
  "refgm_accounts",
  "refgm_profiles",
  "refgm_grade_defs",
] as const;

export type LocalTable = (typeof LOCAL_TABLES)[number];

type Row = Record<string, unknown>;
type Store = Record<LocalTable, Row[]> & { kv: Record<string, unknown> };

const GRADE_SEEDS: Row[] = SYSTEM_GRADE_DEFS.map((grade) => ({
  id: grade.id,
  label: grade.label,
  rank: grade.rank,
  color: grade.color,
  kind: grade.kind,
  is_system: grade.isSystem,
  is_protected: grade.isProtected,
  permissions: Object.fromEntries(
    PERMISSION_FLAGS.map(({ key }) => [key, grade[key]])
  ),
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
}));

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/refgm";

const pool = new Pool({ connectionString: DATABASE_URL });

let cache: Store | null = null;
let loading: Promise<void> | null = null;

function emptyStore(): Store {
  return {
    refgm_accounts: [],
    refgm_profiles: [],
    refgm_grade_defs: GRADE_SEEDS.map((row) => ({ ...row })),
    kv: {},
  };
}

async function seedGrades() {
  for (const row of GRADE_SEEDS) {
    await pool.query(
      `insert into refgm_grade_defs
        (id, label, rank, color, kind, is_system, is_protected, permissions, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
       on conflict (id) do nothing`,
      [
        row.id,
        row.label,
        row.rank,
        row.color,
        row.kind,
        row.is_system,
        row.is_protected,
        JSON.stringify(row.permissions),
        row.created_at,
        row.updated_at,
      ]
    );
  }
}

async function loadFromPostgres(): Promise<Store> {
  await seedGrades();
  const [accounts, profiles, grades, kvRows] = await Promise.all([
    pool.query("select * from refgm_accounts"),
    pool.query("select * from refgm_profiles"),
    pool.query("select * from refgm_grade_defs order by rank asc"),
    pool.query("select key, value from refgm_kv"),
  ]);
  const kv: Record<string, unknown> = {};
  for (const row of kvRows.rows) {
    kv[row.key as string] = row.value;
  }
  return {
    refgm_accounts: accounts.rows,
    refgm_profiles: profiles.rows,
    refgm_grade_defs: grades.rows,
    kv,
  };
}

export async function ensureDb() {
  if (cache) return;
  if (!loading) {
    loading = loadFromPostgres()
      .then((store) => {
        cache = store;
      })
      .finally(() => {
        loading = null;
      });
  }
  await loading;
}

function store(): Store {
  return cache ?? emptyStore();
}

async function flushTable(table: LocalTable) {
  const rows = store()[table];
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`truncate ${table}`);
    for (const row of rows) {
      const keys = Object.keys(row);
      if (keys.length === 0) continue;
      const cols = keys.map((k) => `"${k}"`).join(", ");
      const params = keys.map((_, i) => `$${i + 1}`).join(", ");
      const values = keys.map((k) => {
        const v = row[k];
        return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      });
      await client.query(
        `insert into ${table} (${cols}) values (${params})`,
        values
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertKvKeys(keys: string[]) {
  const kv = store().kv;
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const key of keys) {
      await client.query(
        `insert into refgm_kv (key, value) values ($1, $2::jsonb)
         on conflict (key) do update set value = excluded.value`,
        [key, JSON.stringify(kv[key] ?? null)]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export function isLocalTable(name: string): name is LocalTable {
  return (LOCAL_TABLES as readonly string[]).includes(name);
}

export function primaryKey(table: LocalTable): string {
  return table === "refgm_grade_defs" ? "id" : "user_id";
}

export function listRows(table: LocalTable): Row[] {
  return store()[table];
}

export async function replaceRows(table: LocalTable, rows: Row[]) {
  await ensureDb();
  store()[table] = rows;
  await flushTable(table);
}

export function kvAll(): Record<string, unknown> {
  return { ...store().kv };
}

export function kvGet<T>(key: string, fallback: T): T {
  const value = store().kv[key];
  return value === undefined ? fallback : (value as T);
}

export async function kvSet(key: string, value: unknown) {
  await ensureDb();
  store().kv[key] = value;
  await upsertKvKeys([key]);
}

export async function kvMerge(entries: Record<string, unknown>) {
  await ensureDb();
  store().kv = { ...store().kv, ...entries };
  await upsertKvKeys(Object.keys(entries));
}

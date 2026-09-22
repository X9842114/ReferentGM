import "server-only";

import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
type Filter = { kind: "eq" | "neq" | "in" | "gte"; field: string; value: unknown };
type Operation = "select" | "insert" | "upsert" | "update" | "delete";

type PocketRecord = {
  id: string;
  table_name: string;
  row_key: string;
  payload: Row;
};

type QueryResult = {
  data: Row | Row[] | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
};

const PRIMARY_KEYS: Record<string, string[]> = {
  refgm_accounts: ["user_id"],
  refgm_profiles: ["user_id"],
  refgm_grade_defs: ["id"],
  refgm_gm_applications: ["id"],
  refgm_gm_application_votes: ["application_id", "voter_id"],
  refgm_gm_application_history: ["id"],
  refgm_shared_state: ["state_key"],
  refgm_audit_log: ["id"],
};

function apiUrl(path: string) {
  const origin = process.env.POCKETBASE_URL || "http://127.0.0.1:8090";
  return `${origin.replace(/\/$/, "")}${path}`;
}

function errorMessage(value: unknown) {
  if (value && typeof value === "object" && "message" in value) {
    return String((value as { message?: unknown }).message || "Erreur PocketBase locale.");
  }
  return String(value || "Erreur PocketBase locale.");
}

function rowKey(table: string, row: Row, onConflict?: string) {
  const keys = onConflict?.split(",").map((key) => key.trim()).filter(Boolean)
    ?? PRIMARY_KEYS[table]
    ?? ["id"];
  const values = keys.map((key) => row[key]).filter((value) => value !== undefined && value !== null && value !== "");
  return values.length === keys.length ? values.map(String).join("::") : randomUUID();
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.message || `PocketBase HTTP ${response.status}`);
  return body;
}

class LocalQueryBuilder implements PromiseLike<QueryResult> {
  private operation: Operation = "select";
  private values: Row[] = [];
  private filters: Filter[] = [];
  private orders: Array<{ field: string; ascending: boolean }> = [];
  private maxRows: number | null = null;
  private singleMode: "single" | "maybe" | null = null;
  private head = false;
  private onConflict?: string;

  constructor(private readonly table: string) {}

  select(_columns = "*", options?: { count?: string; head?: boolean }) {
    this.head = options?.head === true;
    return this;
  }

  insert(value: Row | Row[]) {
    this.operation = "insert";
    this.values = Array.isArray(value) ? value : [value];
    return this;
  }

  upsert(value: Row | Row[], options?: { onConflict?: string }) {
    this.operation = "upsert";
    this.values = Array.isArray(value) ? value : [value];
    this.onConflict = options?.onConflict;
    return this;
  }

  update(value: Row) {
    this.operation = "update";
    this.values = [value];
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(field: string, value: unknown) { this.filters.push({ kind: "eq", field, value }); return this; }
  neq(field: string, value: unknown) { this.filters.push({ kind: "neq", field, value }); return this; }
  gte(field: string, value: unknown) { this.filters.push({ kind: "gte", field, value }); return this; }
  in(field: string, value: unknown[]) { this.filters.push({ kind: "in", field, value }); return this; }
  order(field: string, options?: { ascending?: boolean }) { this.orders.push({ field, ascending: options?.ascending !== false }); return this; }
  limit(value: number) { this.maxRows = value; return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }

  private matches(row: Row) {
    return this.filters.every(({ kind, field, value }) => {
      if (kind === "eq") return row[field] === value;
      if (kind === "neq") return row[field] !== value;
      if (kind === "in") return (value as unknown[]).includes(row[field]);
      return String(row[field] ?? "") >= String(value ?? "");
    });
  }

  private async records() {
    const filter = encodeURIComponent(`table_name = "${this.table.replaceAll('"', '\\"')}"`);
    const result = await request(`/api/collections/refgm_rows/records?page=1&perPage=500&filter=${filter}`);
    return (result.items || []) as PocketRecord[];
  }

  private async create(row: Row, forcedKey?: string) {
    const key = forcedKey || rowKey(this.table, row, this.onConflict);
    return request("/api/collections/refgm_rows/records", {
      method: "POST",
      body: JSON.stringify({ table_name: this.table, row_key: key, payload: row }),
    }) as Promise<PocketRecord>;
  }

  private async execute(): Promise<QueryResult> {
    try {
      const records = await this.records();
      let selected = records.filter((record) => this.matches(record.payload));

      if (this.operation === "insert") {
        const created = await Promise.all(this.values.map((row) => this.create({ ...row, id: row.id || randomUUID() })));
        selected = created;
      } else if (this.operation === "upsert") {
        const saved: PocketRecord[] = [];
        for (const raw of this.values) {
          const row = { ...raw };
          const key = rowKey(this.table, row, this.onConflict);
          const current = records.find((record) => record.row_key === key);
          if (current) {
            saved.push(await request(`/api/collections/refgm_rows/records/${current.id}`, {
              method: "PATCH",
              body: JSON.stringify({ payload: { ...current.payload, ...row } }),
            }) as PocketRecord);
          } else {
            if (!row.id && PRIMARY_KEYS[this.table]?.includes("id")) row.id = randomUUID();
            saved.push(await this.create(row, key));
          }
        }
        selected = saved;
      } else if (this.operation === "update") {
        selected = await Promise.all(selected.map((record) => request(`/api/collections/refgm_rows/records/${record.id}`, {
          method: "PATCH",
          body: JSON.stringify({ payload: { ...record.payload, ...this.values[0] } }),
        }) as Promise<PocketRecord>));
      } else if (this.operation === "delete") {
        await Promise.all(selected.map((record) => request(`/api/collections/refgm_rows/records/${record.id}`, { method: "DELETE" })));
        selected = [];
      }

      let rows = selected.map((record) => record.payload);
      for (const order of [...this.orders].reverse()) {
        rows = rows.sort((a, b) => String(a[order.field] ?? "").localeCompare(String(b[order.field] ?? "")) * (order.ascending ? 1 : -1));
      }
      const count = rows.length;
      if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);
      if (this.head) return { data: null, error: null, count };
      if (this.singleMode === "single" && rows.length !== 1) return { data: null, error: { message: rows.length ? "Plusieurs lignes trouvées." : "Ligne introuvable.", code: "PGRST116" }, count };
      if (this.singleMode) return { data: rows[0] ?? null, error: null, count };
      return { data: rows, error: null, count };
    } catch (error) {
      return { data: null, error: { message: errorMessage(error) }, count: null };
    }
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

export function getPocketBaseLocalAdmin() {
  return {
    from(table: string) { return new LocalQueryBuilder(table); },
  };
}

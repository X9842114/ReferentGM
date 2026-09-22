import {
  ensureDb,
  isLocalTable,
  listRows,
  primaryKey,
  replaceRows,
  type LocalTable,
} from "@/lib/local-db";

type Row = Record<string, unknown>;
type Filter = { key: string; op: "eq" | "in"; value: unknown };

function applyFilters(rows: Row[], filters: Filter[]): Row[] {
  return rows.filter((row) =>
    filters.every((filter) => {
      if (filter.op === "eq") return String(row[filter.key]) === String(filter.value);
      const values = (filter.value as unknown[]).map(String);
      return values.includes(String(row[filter.key]));
    })
  );
}

class Query {
  private table: LocalTable;
  private filters: Filter[] = [];
  private orderField: string | null = null;
  private orderAsc = true;
  private mode: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private wantCount = false;
  private head = false;
  private wantSingle = false;
  private wantMaybeSingle = false;

  constructor(table: LocalTable) {
    this.table = table;
  }

  select(_columns?: string, options?: { count?: "exact"; head?: boolean }) {
    this.wantCount = options?.count === "exact";
    this.head = Boolean(options?.head);
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, op: "eq", value });
    return this;
  }

  in(key: string, value: unknown[]) {
    this.filters.push({ key, op: "in", value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  insert(row: Row) {
    this.mode = "insert";
    this.payload = row;
    return this;
  }

  upsert(row: Row, _opts?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = row;
    return this;
  }

  update(row: Row) {
    this.mode = "update";
    this.payload = row;
    return this;
  }

  delete(options?: { count?: "exact" }) {
    this.mode = "delete";
    this.wantCount = options?.count === "exact";
    return this;
  }

  maybeSingle() {
    this.wantMaybeSingle = true;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: {
      data: unknown;
      error: { message: string } | null;
      count: number | null;
    }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    try {
      await ensureDb();
      const pk = primaryKey(this.table);
      let rows = listRows(this.table);
      if (this.mode === "insert" && this.payload && !Array.isArray(this.payload)) {
        rows = [...rows, this.payload];
        await replaceRows(this.table, rows);
        const data = this.payload;
        return {
          data: this.wantSingle || this.wantMaybeSingle ? data : [data],
          error: null,
          count: 1,
        };
      }
      if (this.mode === "upsert" && this.payload && !Array.isArray(this.payload)) {
        const key = String(this.payload[pk] ?? "");
        const idx = rows.findIndex((row) => String(row[pk]) === key);
        if (idx >= 0) rows[idx] = { ...rows[idx], ...this.payload };
        else rows = [...rows, this.payload];
        await replaceRows(this.table, rows);
        return { data: this.payload, error: null, count: 1 };
      }
      if (this.mode === "update" && this.payload && !Array.isArray(this.payload)) {
        const matched = applyFilters(rows, this.filters);
        const keys = new Set(matched.map((row) => String(row[pk])));
        rows = rows.map((row) =>
          keys.has(String(row[pk])) ? { ...row, ...this.payload } : row
        );
        await replaceRows(this.table, rows);
        const next = applyFilters(rows, this.filters);
        return {
          data: this.wantSingle || this.wantMaybeSingle ? next[0] ?? null : next,
          error: next.length || !this.wantSingle ? null : { message: "not found" },
          count: next.length,
        };
      }
      if (this.mode === "delete") {
        const matched = applyFilters(rows, this.filters);
        const keys = new Set(matched.map((row) => String(row[pk])));
        await replaceRows(
          this.table,
          rows.filter((row) => !keys.has(String(row[pk])))
        );
        return {
          data: matched,
          error: null,
          count: matched.length,
        };
      }

      let selected = applyFilters(rows, this.filters);
      if (this.orderField) {
        const field = this.orderField;
        const asc = this.orderAsc;
        selected = [...selected].sort((a, b) => {
          const av = a[field];
          const bv = b[field];
          if (av === bv) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av > bv ? 1 : -1) * (asc ? 1 : -1);
        });
      }
      const count = selected.length;
      if (this.head) {
        return Promise.resolve({ data: null, error: null, count });
      }
      if (this.wantSingle || this.wantMaybeSingle) {
        return Promise.resolve({
          data: selected[0] ?? null,
          error: null,
          count: this.wantCount ? count : null,
        });
      }
      return Promise.resolve({
        data: selected,
        error: null,
        count: this.wantCount ? count : null,
      });
    } catch (cause) {
      return Promise.resolve({
        data: null,
        error: { message: cause instanceof Error ? cause.message : "db error" },
        count: null,
      });
    }
  }
}

export function createLocalSupabase() {
  return {
    from(table: string) {
      if (!isLocalTable(table)) {
        throw new Error(`Table inconnue: ${table}`);
      }
      return new Query(table);
    },
  };
}

export function isLocalSupabaseUrl(url?: string | null) {
  const flag = process.env.REFGM_USE_LOCAL_PG?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  if (!url) return false;
  return url.includes("localhost") || url.includes("127.0.0.1");
}

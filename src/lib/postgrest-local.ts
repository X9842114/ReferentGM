import {
  ensureDb,
  isLocalTable,
  listRows,
  primaryKey,
  replaceRows,
  type LocalTable,
} from "@/lib/local-db";

type Row = Record<string, unknown>;

function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function matches(row: Row, key: string, spec: string): boolean {
  const eq = spec.match(/^eq\.(.+)$/);
  if (eq) {
    return String(row[key]) === String(coerce(eq[1]));
  }
  const inn = spec.match(/^in\.\((.*)\)$/);
  if (inn) {
    const values = inn[1]
      .split(",")
      .map((part) => coerce(part.trim()))
      .map(String);
    return values.includes(String(row[key]));
  }
  return true;
}

function applyFilters(rows: Row[], url: URL): Row[] {
  let next = rows;
  for (const [key, value] of url.searchParams.entries()) {
    if (key === "select" || key === "order" || key === "on_conflict") continue;
    next = next.filter((row) => matches(row, key, value));
  }
  return next;
}

function applyOrder(rows: Row[], url: URL): Row[] {
  const order = url.searchParams.get("order");
  if (!order) return rows;
  const [field, dir] = order.split(".");
  const desc = dir === "desc";
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av > bv ? 1 : -1) * (desc ? -1 : 1);
  });
}

function project(rows: Row[], select: string | null): Row[] {
  if (!select || select === "*") return rows;
  const cols = select.split(",").map((c) => c.trim());
  return rows.map((row) => {
    const out: Row = {};
    for (const col of cols) out[col] = row[col];
    return out;
  });
}

export async function handlePostgrest(
  request: Request,
  tableName: string
): Promise<Response> {
  if (!isLocalTable(tableName)) {
    return Response.json(
      { message: `Unknown table ${tableName}` },
      { status: 404 }
    );
  }
  await ensureDb();
  const table: LocalTable = tableName;
  const url = new URL(request.url);
  const prefer = request.headers.get("prefer") ?? "";
  const wantCount = prefer.includes("count=exact");
  const merge = prefer.includes("resolution=merge-duplicates");
  const asObject =
    request.headers.get("accept")?.includes("vnd.pgrst.object") ?? false;
  const pk = primaryKey(table);

  const jsonHeaders = (count?: number, extra?: HeadersInit) => {
    const headers = new Headers(extra);
    headers.set("Content-Type", "application/json");
    if (wantCount && count != null) {
      const last = Math.max(count - 1, 0);
      headers.set("Content-Range", count ? `0-${last}/${count}` : `*/${count}`);
    }
    return headers;
  };

  if (request.method === "GET" || request.method === "HEAD") {
    const filtered = applyOrder(
      applyFilters(listRows(table), url),
      url
    );
    const body = project(filtered, url.searchParams.get("select"));
    if (request.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: jsonHeaders(filtered.length),
      });
    }
    if (asObject) {
      return new Response(JSON.stringify(body[0] ?? null), {
        status: 200,
        headers: jsonHeaders(filtered.length),
      });
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: jsonHeaders(filtered.length),
    });
  }

  if (request.method === "POST") {
    const payload = await request.json().catch(() => null);
    const items: Row[] = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object"
        ? [payload as Row]
        : [];
    const conflict = url.searchParams.get("on_conflict") ?? pk;
    let rows = listRows(table);
    const written: Row[] = [];
    for (const item of items) {
      const key = String(item[conflict] ?? "");
      const idx = rows.findIndex((row) => String(row[conflict]) === key);
      if (idx >= 0 && merge) {
        rows[idx] = { ...rows[idx], ...item };
        written.push(rows[idx]);
      } else if (idx >= 0) {
        return Response.json(
          { message: "duplicate key", details: key },
          { status: 409 }
        );
      } else {
        rows = [...rows, item];
        written.push(item);
      }
    }
    await replaceRows(table, rows);
    return new Response(JSON.stringify(written), {
      status: 201,
      headers: jsonHeaders(written.length),
    });
  }

  if (request.method === "PATCH") {
    const payload = (await request.json().catch(() => ({}))) as Row;
    let rows = listRows(table);
    const matched = applyFilters(rows, url);
    const keys = new Set(matched.map((row) => String(row[pk])));
    rows = rows.map((row) =>
      keys.has(String(row[pk])) ? { ...row, ...payload } : row
    );
    await replaceRows(table, rows);
    const next = applyFilters(rows, url);
    if (asObject) {
      return new Response(JSON.stringify(next[0] ?? null), {
        status: 200,
        headers: jsonHeaders(next.length),
      });
    }
    return new Response(JSON.stringify(next), {
      status: 200,
      headers: jsonHeaders(next.length),
    });
  }

  if (request.method === "DELETE") {
    const rows = listRows(table);
    const matched = applyFilters(rows, url);
    const keys = new Set(matched.map((row) => String(row[pk])));
    await replaceRows(
      table,
      rows.filter((row) => !keys.has(String(row[pk])))
    );
    return new Response(JSON.stringify(matched), {
      status: 200,
      headers: jsonHeaders(matched.length),
    });
  }

  return new Response(null, { status: 405 });
}

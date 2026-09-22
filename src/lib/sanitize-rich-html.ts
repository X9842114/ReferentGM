const ALLOWED = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "a",
  "span",
]);

export function sanitizeRichHtml(value: unknown) {
  let html = String(value ?? "");
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
  html = html.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED.has(name)) return "";
    if (name === "br") return "<br>";
    if (match.startsWith("</")) return `</${name}>`;
    if (name === "a") {
      const href = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
      const url = (href?.[2] || href?.[3] || "").trim();
      if (!/^(https?:|mailto:)/i.test(url)) return "<a>";
      return `<a href="${url.replace(/"/g, "")}" target="_blank" rel="noopener noreferrer">`;
    }
    return `<${name}>`;
  });
  return html.slice(0, 100_000);
}

export function sanitizeSharedPayload(key: string, payload: unknown): unknown {
  if (!Array.isArray(payload)) return payload;
  if (key === "refgm.missions.v1") {
    return payload.map((row) =>
      row && typeof row === "object"
        ? {
            ...(row as Record<string, unknown>),
            descriptionHtml: sanitizeRichHtml(
              (row as Record<string, unknown>).descriptionHtml
            ),
          }
        : row
    );
  }
  if (key === "refgm.scene-workshops.v1") {
    return payload.map((row) =>
      row && typeof row === "object"
        ? {
            ...(row as Record<string, unknown>),
            documentHtml: sanitizeRichHtml(
              (row as Record<string, unknown>).documentHtml
            ),
          }
        : row
    );
  }
  return payload;
}

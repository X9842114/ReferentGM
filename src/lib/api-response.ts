type ApiResult<T extends Record<string, unknown>> = Partial<T> & { error?: string };

export async function readApiResponse<T extends Record<string, unknown>>(response: Response): Promise<ApiResult<T>> {
  const text = await response.text();
  if (!text.trim()) return { error: response.ok ? undefined : `Service indisponible (erreur ${response.status}).` } as ApiResult<T>;
  try { return JSON.parse(text) as T; } catch {
    const lower = text.toLowerCase();
    if (response.status === 402 || lower.includes("service forbidden") || lower.includes("quota")) {
      return { error: "Supabase a temporairement restreint le projet car le quota gratuit est dépassé. Les candidatures seront de nouveau accessibles après la levée de la restriction." } as ApiResult<T>;
    }
    if (response.status >= 500 || lower.startsWith("service")) {
      return { error: "Le service des candidatures est temporairement indisponible. Réessaie dans quelques minutes." } as ApiResult<T>;
    }
    return { error: `Réponse inattendue du serveur (erreur ${response.status}).` } as ApiResult<T>;
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const form = options.body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? "GET", credentials: "same-origin",
      headers: { "X-Vitrine-Client": "web", ...(options.body !== undefined && !form ? { "Content-Type": "application/json" } : {}) },
      body: options.body === undefined ? undefined : form ? options.body as FormData : JSON.stringify(options.body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch { throw new Error("Não foi possível conectar ao servidor. Confira sua conexão e tente novamente."); }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const fields = payload?.fields as Record<string, string[]> | undefined;
    const detail = fields ? Object.values(fields).flat().join(" ") : "";
    throw new Error(detail || payload?.error || "Não foi possível concluir a operação.");
  }
  if (!payload) throw new Error("O servidor enviou uma resposta inválida.");
  return payload as T;
}

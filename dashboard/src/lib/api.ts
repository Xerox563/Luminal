export const API_URL = "http://localhost:8000";

export const NODE_COLORS: Record<string, string> = {
  analyze: "#60a5fa",
  retrieve: "#a78bfa",
  tool: "#fbbf24",
  route: "#34d399",
  generate: "#f87171",
  critic: "#f472b6",
  approval: "#fb923c",
  error_recovery: "#ef4444",
};

export const fmtMoney = (v: number, digits = 4) =>
  v >= 1000 ? `$${v.toFixed(2)}` : `$${v.toFixed(digits)}`;

export const fmtNum = (v: number) => v.toLocaleString();

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const fmtShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const shortModel = (m: string) => {
  const parts = m.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : m;
};

export function jwtSubject(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

export function newSessionId(token: string): string | null {
  const sub = jwtSubject(token);
  if (!sub) return null;
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `user_${sub}_${rand}`;
}

export async function api<T>(
  path: string,
  token: string | null,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("auth");
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string" ? data.detail : `Request failed (${res.status})`
    );
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
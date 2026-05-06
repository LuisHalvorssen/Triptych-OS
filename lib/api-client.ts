// Tiny wrapper around fetch for the in-app API. Used by client-side code
// (useScopedTasks + page-level handlers) instead of talking to Supabase
// directly.
//
// The browser no longer holds the anon key; every CRUD goes via Next.js
// routes that use the service_role key server-side.

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  url: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers || {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* keep statusText */
    }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, json?: unknown) =>
    request<T>(url, { method: "POST", json }),
  patch: <T>(url: string, json?: unknown) =>
    request<T>(url, { method: "PATCH", json }),
  del: <T>(url: string) => request<T>(url, { method: "DELETE" }),
};

// Fire-and-forget DELETE that survives page unload. Used by the
// soft-delete-with-undo path: when a tab is closing and we still hold
// pending deletes from the 4-second undo window, we commit them right now.
export function syncDeleteTaskOnUnload(id: string): void {
  try {
    fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: "DELETE",
      keepalive: true,
    });
  } catch {
    // Best-effort. The user is already navigating away.
  }
}

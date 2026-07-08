// Lightweight fetch wrapper that mimics axios .get/.post/.put/.delete
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

type Response<T> = { data: T; status: number };

async function request<T>(
  method: string,
  path: string,
  body?: any
): Promise<Response<T>> {
  const url = `${BACKEND_URL}/api${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const err: any = new Error(
      (data && data.detail) || `HTTP ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return { data: data as T, status: res.status };
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T>(path: string, body?: any) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

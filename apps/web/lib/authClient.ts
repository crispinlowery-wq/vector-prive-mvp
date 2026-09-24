"use client";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const SESSION_KEY = "vector-prive-session";
const MANAGED_TOKEN = "managed";

export type SessionUser = {
  id: string;
  client_id: string | null;
  email: string;
  full_name: string;
  role: "client" | "pa" | "operator" | "admin";
};

export type LoginResult = {
  ok: boolean;
  message: string;
  token?: string;
  user?: SessionUser;
};

export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) throw new Error("Login failed");
    const data = await response.json();
    saveSession(data);
    return { ok: true, message: "Welcome back.", token: data.access_token, user: data.user };
  } catch {
    return { ok: false, message: "We couldn’t sign you in. Check that the secure API is running and try again." };
  }
}

export async function requestPasswordReset(email: string) {
  try {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) throw new Error("Reset failed");
    const data = await response.json();
    return data.message || "If an account exists, a reset link has been sent.";
  } catch {
    return "If an account exists, a reset link will be sent once email is configured.";
  }
}

export async function resetPassword(token: string, password: string) {
  try {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) throw new Error("Reset failed");
    const data = await response.json();
    return { ok: true, message: data.message || "Password reset. You can now sign in." };
  } catch {
    return { ok: false, message: "Password reset requires the API database to be running." };
  }
}

function saveSession(data: { access_token: string; user: SessionUser }) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({
    token: data.access_token,
    user: data.user,
    createdAt: new Date().toISOString(),
  }));
}

async function getManagedAccessToken(): Promise<string> {
  const response = await fetch("/api/auth-token", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("Sign in is required.");
  const data = await response.json();
  if (!data.token) throw new Error("Sign in is required.");
  return data.token;
}

export async function ensureSession(): Promise<SessionUser | null> {
  const existing = getSession();
  if (existing) return existing.user;
  try {
    const token = await getManagedAccessToken();
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const user = await response.json() as SessionUser;
    saveSession({ access_token: MANAGED_TOKEN, user });
    return user;
  } catch {
    return null;
  }
}

export function getSession(): { token: string; user: SessionUser } | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
    return value?.token && value?.user ? value : null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = getSession();
  if (!session) throw new Error("Sign in is required.");
  const token = session.token === MANAGED_TOKEN ? await getManagedAccessToken() : session.token;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function logout(): Promise<string> {
  const session = getSession();
  if (session?.token !== MANAGED_TOKEN) {
    try { await apiFetch<void>("/auth/logout", { method: "POST" }); } catch { /* clear locally even if the API is unavailable */ }
  }
  window.localStorage.removeItem(SESSION_KEY);
  return session?.token === MANAGED_TOKEN ? "/auth/logout" : "/login";
}

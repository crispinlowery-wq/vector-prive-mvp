import { auth0, managedAuthConfigured } from "@/lib/auth0";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!managedAuthConfigured) {
    return Response.json({ detail: "Managed authentication is not configured" }, { status: 503 });
  }
  try {
    const { token, expiresAt } = await auth0.getAccessToken();
    return Response.json({ token, expires_at: expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ detail: "Authentication required" }, { status: 401 });
  }
}

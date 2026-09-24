"use client";

import { apiFetch, ensureSession } from "@/lib/authClient";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function AuthBootstrap() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    void (async () => {
      const user = await ensureSession();
      if (!user || user.role === "admin" || user.role === "operator" || pathname === "/onboarding") return;
      try {
        const onboarding = await apiFetch<{ completed: boolean }>("/onboarding");
        if (!onboarding.completed) router.replace("/onboarding");
      } catch {
        // The requested page can display its own API error without creating a redirect loop.
      }
    })();
  }, [pathname, router]);
  return null;
}

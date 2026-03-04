"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { clientAuth } from "@/src/lib/firebase/client";
import { Button } from "@/src/components/ui/button";
import { ca } from "@/src/i18n/ca";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/session-logout", { method: "POST" });
    await signOut(clientAuth).catch(() => undefined);
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={onLogout}>
      {ca.nav.logout}
    </Button>
  );
}

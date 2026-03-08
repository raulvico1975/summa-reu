import { redirect } from "next/navigation";
import type { OwnerContext } from "@/src/lib/firebase/auth";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { getRequestLocale } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";

export async function requireOwnerPage(): Promise<OwnerContext> {
  const locale = await getRequestLocale();
  const owner = await getOwnerFromServerCookies();
  if (!owner) {
    redirect(withLocalePath(locale, "/login"));
  }
  if (owner.subscriptionStatus !== "active") {
    redirect(withLocalePath(locale, "/billing"));
  }

  return owner;
}

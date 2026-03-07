import { redirect } from "next/navigation";
import type { OwnerContext } from "@/src/lib/firebase/auth";
import { getOwnerFromServerCookies } from "@/src/lib/firebase/auth";
import { withLocalePath } from "@/src/i18n/routing";
import { getRequestLocale } from "@/src/i18n/server";
import {
  isSubscriptionRequiredError,
  requireActiveSubscription,
} from "@/src/lib/auth/require-active-subscription";

function extractLocale(pathname: string | undefined): "ca" | "es" | null {
  if (!pathname) {
    return null;
  }

  const maybeLocale = pathname.split("/")[1];
  if (maybeLocale === "ca" || maybeLocale === "es") {
    return maybeLocale;
  }

  return null;
}

type RequireOwnerPageOptions = {
  allowInactiveSubscription?: boolean;
  pathname?: string;
};

export async function requireOwnerPage(options?: RequireOwnerPageOptions): Promise<OwnerContext> {
  const locale = extractLocale(options?.pathname) ?? (await getRequestLocale());
  const owner = await getOwnerFromServerCookies();
  if (!owner) {
    redirect(withLocalePath(locale, "/login"));
  }

  if (!options?.allowInactiveSubscription) {
    try {
      requireActiveSubscription(owner);
    } catch (error) {
      if (isSubscriptionRequiredError(error)) {
        redirect(withLocalePath(locale, "/billing"));
      }

      throw error;
    }
  }

  return owner;
}

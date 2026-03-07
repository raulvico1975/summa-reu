import { headers } from "next/headers";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const headerStore = await headers();
  await requireOwnerPage({
    pathname: headerStore.get("x-pathname") ?? headerStore.get("next-url") ?? undefined,
  });
  return children;
}

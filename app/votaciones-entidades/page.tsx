import { permanentRedirect } from "next/navigation";
import { getRequestI18n } from "@/src/i18n/server";
import { withLocalePath } from "@/src/i18n/routing";

export default async function VotacionesEntidadesPage() {
  const { locale } = await getRequestI18n();
  permanentRedirect(withLocalePath(locale, "/convocatorias-y-votaciones"));
}

import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { SettingsForm } from "@/src/components/settings/settings-form";
import { getOrgById } from "@/src/lib/db/repo";
import { requireOwnerPage } from "@/src/lib/ui/owner-page";
import { getRequestI18n } from "@/src/i18n/server";

export default async function SettingsPage() {
  const { i18n } = await getRequestI18n();
  const owner = await requireOwnerPage();
  const org = await getOrgById(owner.orgId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {i18n.settings.title}
      </h1>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.settings.orgNameLabel}</h2>
        </CardHeader>
        <CardContent>
          <SettingsForm
            section="orgName"
            initialOrgName={org?.name ?? ""}
            initialLanguage={org?.language ?? "ca"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.settings.languageTitle}</h2>
        </CardHeader>
        <CardContent>
          <SettingsForm
            section="language"
            initialOrgName={org?.name ?? ""}
            initialLanguage={org?.language ?? "ca"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">{i18n.settings.passwordTitle}</h2>
        </CardHeader>
        <CardContent>
          <SettingsForm
            section="password"
            initialOrgName={org?.name ?? ""}
            initialLanguage={org?.language ?? "ca"}
          />
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <h2 className="text-base font-semibold text-red-700">{i18n.settings.deleteTitle}</h2>
          <p className="text-sm text-slate-600">{i18n.settings.deleteDescription}</p>
        </CardHeader>
        <CardContent>
          <SettingsForm
            section="delete"
            initialOrgName={org?.name ?? ""}
            initialLanguage={org?.language ?? "ca"}
          />
        </CardContent>
      </Card>
    </div>
  );
}

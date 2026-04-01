import type { Metadata } from "next";
import { getRequestI18n } from "@/src/i18n/server";
import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import { localizedPublicMetadata } from "@/src/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getRequestI18n();
  const title = locale === "es" ? "Ayuda | Summa Reu" : "Ajuda | Summa Reu";
  const description =
    locale === "es"
      ? "Manual y preguntas frecuentes de Summa Reu para convocatorias, reuniones y actas."
      : "Manual i preguntes freqüents de Summa Reu per a convocatòries, reunions i actes.";

  return localizedPublicMetadata({
    locale,
    path: "/help",
    title,
    description,
  });
}

export default async function HelpPage() {
  const { i18n } = await getRequestI18n();
  const { help } = i18n;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{help.title}</h1>
        <p className="text-slate-600">{help.manualIntro}</p>
      </header>

      <nav className="rounded-lg border border-slate-200 bg-white p-4">
        <ul className="columns-1 gap-x-8 space-y-1 text-sm sm:columns-2">
          {help.manualSections.map((section, i) => (
            <li key={i}>
              <a
                href={`#manual-${i}`}
                className="text-sky-600 hover:underline"
              >
                {i + 1}. {section.title}
              </a>
            </li>
          ))}
          <li className="pt-1 font-medium">
            <a href="#faq" className="text-sky-600 hover:underline">
              {help.faqIntro.split(".")[0]}
            </a>
          </li>
        </ul>
      </nav>

      <section className="space-y-8">
        {help.manualSections.map((section, i) => (
          <Card key={i} id={`manual-${i}`} className="border-slate-200">
            <CardHeader>
              <h2 className="text-lg font-semibold">
                {i + 1}. {section.title}
              </h2>
            </CardHeader>
            <CardContent>
              <HelpBody text={section.content} />
            </CardContent>
          </Card>
        ))}
      </section>

      <section id="faq" className="space-y-8">
        <h2 className="text-xl font-semibold">{help.faqIntro.split(".")[0]}</h2>

        {help.faqCategories.map((category, ci) => (
          <div key={ci} className="space-y-3">
            <h3 className="text-base font-semibold text-slate-800">
              {category.title}
            </h3>
            <div className="space-y-4">
              {category.items.map((item, qi) => (
                <details
                  key={qi}
                  className="group rounded-lg border border-slate-200 bg-white"
                >
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50">
                    {item.q}
                  </summary>
                  <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}

        <p className="text-sm text-slate-500">{help.faqContact}</p>
      </section>
    </div>
  );
}

function HelpBody({ text }: { text: string }) {
  const paragraphs = text.split("\n\n");

  return (
    <div className="space-y-3 text-sm text-slate-700">
      {paragraphs.map((p, i) => {
        const lines = p.split("\n");
        const isList = lines.every((l) => l.startsWith("• ") || l.startsWith("   • "));

        if (isList) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((line, li) => (
                <li key={li}>{line.replace(/^•\s*/, "").replace(/^\s+•\s*/, "")}</li>
              ))}
            </ul>
          );
        }

        const hasSteps = lines.some((l) => /^\d+\./.test(l));
        if (hasSteps && lines.length > 1) {
          return (
            <div key={i} className="space-y-1">
              {lines.map((line, li) => (
                <p key={li}>{line}</p>
              ))}
            </div>
          );
        }

        return <p key={i}>{p}</p>;
      })}
    </div>
  );
}

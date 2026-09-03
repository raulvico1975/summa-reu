import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexió MCP | Summa Social',
  description: 'Informació del pilot de connexió MCP de Summa Social.',
  robots: { index: false, follow: false },
};

export default function PublicMcpDocumentationPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16 text-foreground">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Summa Social</p>
        <h1 className="text-3xl font-bold tracking-tight">Connexió MCP</h1>
        <p className="text-muted-foreground">
          Aquest pilot permet consultar informació operativa de Summa Social des d&apos;un client autoritzat.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Límits del pilot</h2>
        <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Només està disponible per a la persona i l&apos;entitat autoritzades.</li>
          <li>Només permet consultes de comptes, contactes, moviments i resum operatiu.</li>
          <li>Les respostes minimitzen les dades sensibles; no exposen identificadors complets.</li>
          <li>No pot crear, modificar ni eliminar dades, fer pagaments ni executar accions fiscals.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Autorització</h2>
        <p className="text-muted-foreground">
          La connexió requereix iniciar sessió a Summa Social i autoritzar explícitament els permisos de lectura.
          L&apos;accés es revoca quan es retira el consentiment o l&apos;autorització del pilot.
        </p>
      </section>
    </main>
  );
}

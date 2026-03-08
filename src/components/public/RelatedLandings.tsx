import Link from 'next/link';
import type { PublicLandingRelatedSection } from '@/lib/public-landings';

interface RelatedLandingsProps {
  section: PublicLandingRelatedSection;
}

export function RelatedLandings({ section }: RelatedLandingsProps) {
  const guideLabel = 'Guia relacionada';

  return (
    <section className="border-t pt-10">
      <h2 className="text-2xl font-bold mb-3">{section.title}</h2>
      <p className="text-muted-foreground mb-6">{section.intro}</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={section.guide.href}
          className="rounded-xl border border-border/60 p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
        >
          <p className="text-sm font-semibold text-primary mb-2">{guideLabel}</p>
          <p className="font-medium mb-2">{section.guide.label}</p>
          <p className="text-sm text-muted-foreground">{section.guide.description}</p>
        </Link>

        {section.items.map((item) => (
          <Link
            key={item.slug}
            href={item.href}
            className="rounded-xl border border-border/60 p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
          >
            <p className="font-medium mb-2">{item.title}</p>
            <p className="text-sm text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

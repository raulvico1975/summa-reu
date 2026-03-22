import { notFound, redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function RedirectQuiSommesNous({ params }: PageProps) {
  const { lang } = await params;

  if (lang === 'fr') {
    redirect(`/${lang}/qui-som`);
  }

  notFound();
}

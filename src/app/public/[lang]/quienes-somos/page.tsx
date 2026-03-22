import { notFound, redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function RedirectQuienesSomos({ params }: PageProps) {
  const { lang } = await params;

  if (lang === 'es') {
    redirect(`/${lang}/qui-som`);
  }

  notFound();
}

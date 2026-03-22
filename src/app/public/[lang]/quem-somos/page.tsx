import { notFound, redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function RedirectQuemSomos({ params }: PageProps) {
  const { lang } = await params;

  if (lang === 'pt') {
    redirect(`/${lang}/qui-som`);
  }

  notFound();
}

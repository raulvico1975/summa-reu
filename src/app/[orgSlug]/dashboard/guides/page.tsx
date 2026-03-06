import { redirect } from 'next/navigation';

type GuidesPageProps = {
  params: Promise<{
    orgSlug: string;
  }>;
};

export default async function GuidesPage({ params }: GuidesPageProps) {
  const { orgSlug } = await params;
  redirect(`/${orgSlug}/dashboard`);
}

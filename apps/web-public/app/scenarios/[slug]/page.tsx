import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getScenario } from '../../../lib/content';
import { APP_URL } from '../../../lib/config';

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const scenario = await getScenario(slug);
  if (!scenario) return { title: 'Scenario not found' };
  return {
    title: scenario.title,
    description: scenario.description,
    alternates: { canonical: `/scenarios/${scenario.slug}` },
    openGraph: {
      title: `${scenario.title} · Lingua`,
      description: scenario.description,
      type: 'article',
    },
  };
}

export default async function ScenarioPage({ params }: Params) {
  const { slug } = await params;
  const scenario = await getScenario(slug);
  if (!scenario) notFound();

  return (
    <div className="container">
      <p>
        <Link href="/scenarios">← All scenarios</Link>
      </p>
      <h1>{scenario.title}</h1>
      <p>
        <strong>Level:</strong> {scenario.level}
      </p>
      <p>{scenario.description}</p>
      <p>
        <a href={APP_URL}>Sign in to practise this scenario →</a>
      </p>
    </div>
  );
}

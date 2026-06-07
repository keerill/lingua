import type { MetadataRoute } from 'next';
import { getScenarios } from '../lib/content';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4205';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const scenarios = await getScenarios();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/scenarios`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const scenarioRoutes: MetadataRoute.Sitemap = scenarios.map((s) => ({
    url: `${SITE_URL}/scenarios/${s.slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...scenarioRoutes];
}

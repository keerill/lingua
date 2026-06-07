import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { APP_URL } from '../lib/config';
import './globals.scss';

const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4205';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Lingua — practise English with an AI partner',
    template: '%s · Lingua',
  },
  description:
    'Lingua is an AI English trainer: spaced-repetition vocabulary, real-time conversation practice, and a feedback loop that turns your mistakes into review cards.',
  openGraph: {
    title: 'Lingua — practise English with an AI partner',
    description:
      'Spaced-repetition vocabulary, real-time AI conversation, and a feedback loop that turns mistakes into review cards.',
    type: 'website',
    url: SITE_URL,
    siteName: 'Lingua',
  },
  twitter: { card: 'summary_large_image', title: 'Lingua' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="siteHeader">
          <nav>
            <Link href="/" className="brand">
              🗣️ Lingua
            </Link>
            <Link href="/scenarios">Scenarios</Link>
            <Link href="/pricing">Pricing</Link>
            <span className="spacer" />
            <a href={APP_URL}>Open the app →</a>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="siteFooter">
          <div className="container">
            <span>© {new Date().getFullYear()} Lingua</span>
            <span>Built as a distributed-systems portfolio.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

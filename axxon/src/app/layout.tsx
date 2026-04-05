// Configures the root application shell, metadata, global providers, and brand typography.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Manrope, Space_Grotesk } from 'next/font/google';

import './globals.css';
import QueryProvider from './QueryProvider';
import GlobalOverlayHost from '@/components/ui/GlobalOverlayHost';
import { LabelPopupProvider } from '@/context/LabelPopupManager';
import { ModalProvider } from '@/context/ModalManager';
import { ThemeProvider } from '@/context/ThemeProvider';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Axxon | AI-Native Agile Platform',
  description:
    'Axxon helps software teams coordinate organizations, boards, repo context, and AI agent execution inside one structured operating layer.',
  openGraph: {
    title: 'Axxon | AI-Native Agile Platform',
    description:
      'Plan, dispatch, and review AI agent work with one premium control layer for engineering teams.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${displayFont.variable}`}
    >
      <body className="theme-transition antialiased">
        <ThemeProvider>
          <QueryProvider>
            <ModalProvider>
              <LabelPopupProvider>
                {children}
                <GlobalOverlayHost />
              </LabelPopupProvider>
            </ModalProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

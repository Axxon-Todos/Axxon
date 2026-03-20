import type { Metadata } from 'next';
import "./globals.css";
import QueryProvider from "./QueryProvider";
import { ModalProvider } from "@/context/ModalManager";
import { LabelPopupProvider } from "@/context/LabelPopupManager";
import { ThemeProvider } from "@/context/ThemeProvider";
import GlobalOverlayHost from "@/components/ui/GlobalOverlayHost";

export const metadata: Metadata = {
  title: 'Axxon | Agent Work Orchestration Platform',
  description:
    'Axxon helps software teams organize boards, members, repo context, and AI-assisted execution under one structured operating layer.',
  openGraph: {
    title: 'Axxon | Agent Work Orchestration Platform',
    description:
      'Coordinate engineering organizations, boards, and agent workflows with one structured control layer.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased theme-transition">
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

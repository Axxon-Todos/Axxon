import type { Metadata } from 'next';
import "./globals.css";
import QueryProvider from "./QueryProvider";
import { ModalProvider } from "@/context/ModalManager";
import { LabelPopupProvider } from "@/context/LabelPopupManager";
import { ThemeProvider } from "@/context/ThemeProvider";
import GlobalOverlayHost from "@/components/ui/GlobalOverlayHost";

export const metadata: Metadata = {
  title: 'Axxon | Modular Project Management Platform',
  description:
    'Axxon is a customizable project management platform for teams that need modular workflows, real-time collaboration, and scalable execution.',
  openGraph: {
    title: 'Axxon | Modular Project Management Platform',
    description:
      'Design your own project operating system with composable boards, categories, labels, and collaboration flows.',
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

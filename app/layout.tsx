import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: 'ManaoHQ | COMMAND THE CHAOS',
  description: 'ManaoHQ | Command the Chaos - Premium enterprise-grade content management platform',
  icons: {
    icon: '/logo-manao.svg',
    apple: '/logo-manao.svg',
  },
};

import { Suspense } from 'react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${manrope.variable} antialiased bg-background-light dark:bg-background-dark text-text-main dark:text-gray-100`} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <Toaster position="bottom-right" richColors theme="system" />
          <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center text-text-muted bg-background-light dark:bg-background-dark">Loading ManaoHQ...</div>}>
            {children}
            <ServiceWorkerRegistration />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter, DM_Mono, Instrument_Serif } from 'next/font/google';
import { warpClerkAppearance } from '@/lib/warp-theme';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from 'sonner';
import { NavbarVisibility } from '@/components/navigation/NavbarVisibility';
import { ClerkNetworkErrorHandler } from '@/components/auth/ClerkNetworkErrorHandler';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const dmMono = DM_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-dm-mono',
  display: 'swap',
});

const instrumentSerif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SomePharm Maintenance ',
  description: 'Gestion de stock et inventaire somepharm',
  icons: {
    icon: [
      { url: '/icon.png', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/icon.png',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={warpClerkAppearance}>
      <ClerkNetworkErrorHandler />
      <html lang="fr" className="h-full dark">
        <body
          className={`${inter.variable} ${dmMono.variable} ${instrumentSerif.variable} font-sans h-full bg-[#18181b] text-[#fafafa] antialiased flex flex-col`}
        >
          <QueryProvider>
            <NavbarVisibility />
            <div className="flex-1">
              {children}
            </div>
            <Toaster
              position="top-right"
              theme="dark"
              toastOptions={{
                style: {
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  color: '#fafafa',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-inter), sans-serif',
                  fontSize: '13px',
                },
              }}
            />
          </QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

import { ClerkProvider } from '@clerk/nextjs';
import { notionClerkAppearance } from '@/lib/notion-theme';
import './globals.css';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={notionClerkAppearance}>
      <html lang="fr" className="h-full">
        <body className="h-full bg-[#f6f5f4] text-[#37352f] antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
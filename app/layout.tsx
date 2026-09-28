import type { Metadata, Viewport } from 'next';
import { Outfit, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import './globals.css';

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    template: '%s · POSTY',
    default: 'POSTY — Gestión Hotelera',
  },
  description: 'Software de gestión empresarial para hoteles',
  applicationName: 'POSTY',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#9c0b21' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0c0d' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es"
      className={`${outfit.variable} ${plusJakarta.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex h-full flex-col">
        <ThemeProvider>
          <QueryProvider>
            <TooltipProvider>
              {children}
              <Toaster
                richColors
                position="top-right"
                toastOptions={{
                  className: 'rounded-[10px] shadow-lg',
                }}
              />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileHeader } from '@/components/layout/mobile-header';
import { MobileNavWrapper } from '@/components/layout/mobile-nav-wrapper';
import { SetupProgressWrapper } from '@/components/onboarding/setup-progress-wrapper';
import { GeoProvider } from '@/components/providers/geo-provider';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const initialCountry = cookieStore.get('posty_country')?.value ?? 'CO';

  return (
    <GeoProvider initialCountry={initialCountry}>
      <div className="h-screen-safe flex">
        {/* Sidebar: hidden on mobile, rail on tablet (md-lg), full on desktop (xl+) */}
        <Sidebar />

        {/* Mobile nav drawer — rendered outside main flow */}
        <MobileNavWrapper />

        {/* Onboarding progress button — floating bottom-right */}
        <SetupProgressWrapper />

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col md:overflow-hidden overflow-x-clip">
          {/* Mobile header (< 768px) */}
          <MobileHeader />

          {/* Desktop header (≥ 768px) */}
          <Header />

          {/* Page content */}
          <main className="flex-1 md:overflow-y-auto">
            <div className="page-px mx-auto max-w-[1440px] py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </GeoProvider>
  );
}

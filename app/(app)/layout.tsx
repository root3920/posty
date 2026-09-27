import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { GeoProvider } from '@/components/providers/geo-provider';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const initialCountry = cookieStore.get('posty_country')?.value ?? 'CO';

  return (
    <GeoProvider initialCountry={initialCountry}>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </GeoProvider>
  );
}

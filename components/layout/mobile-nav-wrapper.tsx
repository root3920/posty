'use client';

import { MobileNav } from './mobile-nav';
import { useMobileNavStore } from './mobile-nav-store';

export function MobileNavWrapper() {
  const { open, setOpen } = useMobileNavStore();
  return <MobileNav open={open} onOpenChange={setOpen} />;
}

'use client';

import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface FilterBarProps {
  children: ReactNode;
  activeCount?: number;
}

export function FilterBar({ children, activeCount = 0 }: FilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: inline filters */}
      <div className="hidden items-center gap-3 md:flex">
        {children}
      </div>

      {/* Mobile: single button that opens bottom sheet */}
      <div className="md:hidden">
        <Button
          variant="outline"
          className="touch-target gap-2"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
          {activeCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="flex max-h-[85dvh] flex-col gap-0 rounded-t-2xl p-0"
          >
            {/* Header */}
            <SheetHeader className="flex flex-row items-center justify-between border-b px-4 py-3">
              <SheetTitle>Filtros</SheetTitle>
              <SheetClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cerrar filtros"
                  />
                }
              >
                <X className="h-4 w-4" />
              </SheetClose>
            </SheetHeader>

            {/* Filters stacked vertically */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
              {children}
            </div>

            {/* Apply button */}
            <div
              className="border-t px-4 py-3"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
            >
              <Button
                className="w-full touch-target"
                onClick={() => setOpen(false)}
              >
                Aplicar
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

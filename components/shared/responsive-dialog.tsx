'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-media-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Dialog width on desktop.
   * - sm: 420px  (confirmations, simple forms)
   * - md: 520px  (default — standard forms)
   * - lg: 720px  (wizards, wide forms)
   * - xl: 1000px (composers, multi-column)
   * - 2xl: 1200px (dashboards, large editors)
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

/**
 * Width classes per size.
 *
 * Each entry overrides BOTH the base `max-w-[calc(100%-2rem)]` (mobile)
 * AND the `sm:max-w-sm` from DialogContent, using the same `sm:` breakpoint
 * so tailwind-merge replaces instead of stacking.
 */
const SIZE_CLASSES: Record<NonNullable<ResponsiveDialogProps['size']>, string> = {
  sm:  'w-[94vw] sm:max-w-[420px]',
  md:  'w-[94vw] sm:max-w-[520px]',
  lg:  'w-[94vw] sm:max-w-[720px]',
  xl:  'w-[94vw] sm:max-w-[1000px]',
  '2xl': 'w-[94vw] sm:max-w-[1200px]',
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-48px)] flex-col gap-0 rounded-t-2xl p-0"
        >
          {/* Sticky header */}
          <SheetHeader className="sticky top-0 z-10 flex flex-row items-center justify-between border-b bg-popover px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="text-base">{title}</SheetTitle>
              {description && (
                <SheetDescription className="text-xs">{description}</SheetDescription>
              )}
            </div>
            <SheetClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Cerrar"
                />
              }
            >
              <X className="h-4 w-4" />
            </SheetClose>
          </SheetHeader>

          {/* Scrollable body */}
          <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4">
            {children}
          </div>

          {/* Sticky footer */}
          {footer && (
            <div
              className="safe-bottom sticky bottom-0 border-t bg-popover px-4 py-3"
              style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
            >
              {footer}
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={`${SIZE_CLASSES[size]} flex max-h-[calc(100dvh-4rem)] flex-col`}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</div>

        {footer && (
          <div className="-mx-4 -mb-4 shrink-0 rounded-b-xl border-t bg-muted/50 p-4">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

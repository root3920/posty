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
  /** Dialog width on desktop. Default 'md' (max-w-lg). Use 'lg' for wizards. */
  size?: 'md' | 'lg';
}

const SIZE_CLASSES = {
  md: 'max-w-lg',
  lg: 'w-[calc(100vw-2rem)] max-w-2xl',
} as const;

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
      <DialogContent showCloseButton className={SIZE_CLASSES[size]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="min-w-0 overflow-x-hidden">{children}</div>

        {footer && (
          <div className="-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

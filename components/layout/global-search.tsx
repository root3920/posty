'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, BedDouble, CheckSquare, CalendarCheck, CalendarDays, Loader2, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
// eslint-disable-next-line no-restricted-imports -- Search dialog needs custom layout, not ResponsiveDialog
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchResult {
  type: 'guest' | 'room' | 'task' | 'stay' | 'event';
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  guest: <User className="h-4 w-4" />,
  room: <BedDouble className="h-4 w-4" />,
  task: <CheckSquare className="h-4 w-4" />,
  stay: <CalendarCheck className="h-4 w-4" />,
  event: <CalendarDays className="h-4 w-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  guest: 'Huéspedes',
  room: 'Habitaciones',
  task: 'Tareas',
  stay: 'Reservas',
  event: 'Eventos',
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }

  const searchMutation = useMutation({
    mutationFn: async (q: string): Promise<SearchResult[]> => {
      if (q.trim().length < 2) return [];
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('global_search', {
        p_query: q.trim(),
        p_limit: 8,
      });
      if (error) {
        console.error('[search]', error);
        return [];
      }
      return (data as unknown as SearchResult[]) ?? [];
    },
    onSuccess: (data) => {
      setResults(data);
      setSelectedIndex(0);
    },
  });

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      searchMutation.mutate(query);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      navigate(results[selectedIndex].href);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  let flatIndex = 0;

  return (
    <>
      {/* Desktop trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative hidden max-w-md flex-1 md:flex"
      >
        <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <div className="flex h-9 w-full items-center rounded-[10px] border bg-background pl-9 pr-3 text-sm text-muted-foreground shadow-xs">
          Buscar huésped, habitación, tarea...
          <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:inline">
            ⌘K
          </kbd>
        </div>
      </button>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted md:hidden"
        aria-label="Buscar"
      >
        <Search className="h-4 w-4" />
      </button>

      {/* Search dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="w-[94vw] sm:max-w-[560px] gap-0 overflow-hidden p-0"
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar huésped, habitación, tarea, reserva..."
              className="h-12 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {searchMutation.isPending && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searchMutation.isPending && query.length >= 2 && results.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Sin resultados para &ldquo;{query}&rdquo;
              </div>
            )}

            {query.length > 0 && query.length < 2 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Escribe al menos 2 caracteres
              </div>
            )}

            {Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {TYPE_LABELS[type] ?? type}
                </p>
                {items.map((item) => {
                  const idx = flatIndex++;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.href)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors',
                        idx === selectedIndex
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted',
                      )}
                    >
                      <span className="shrink-0 text-muted-foreground">
                        {TYPE_ICONS[item.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.title}</p>
                        {item.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {results.length > 0 && (
            <div className="flex items-center gap-4 border-t px-3 py-2 text-[10px] text-muted-foreground">
              <span>↑↓ navegar</span>
              <span>↵ abrir</span>
              <span>esc cerrar</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

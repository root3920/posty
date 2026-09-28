import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  /** 1 = always visible, 2 = tablet+, 3 = desktop only */
  priority: 1 | 2 | 3;
  render: (row: T) => ReactNode;
  className?: string;
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  renderCard: (row: T, index: number) => ReactNode;
  actions?: (row: T) => ReactNode;
  keyExtractor: (row: T) => string | number;
  className?: string;
}

const priorityClass: Record<1 | 2 | 3, string> = {
  1: '',
  2: 'hidden md:table-cell',
  3: 'hidden lg:table-cell',
};

export function ResponsiveTable<T>({
  columns,
  data,
  renderCard,
  keyExtractor,
  className,
}: ResponsiveTableProps<T>) {
  return (
    <>
      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        {data.map((row, index) => (
          <div key={keyExtractor(row)}>
            {renderCard(row, index)}
          </div>
        ))}
      </div>

      {/* Tablet/Desktop: table */}
      <div className={cn('hidden md:block', 'overflow-x-auto rounded-xl border border-border', className)}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium text-muted-foreground',
                    // Sticky first column
                    col === columns[0] && 'sticky left-0 z-10 bg-muted/40',
                    priorityClass[col.priority],
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="bg-card transition-colors hover:bg-muted/30"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3',
                      // Sticky first column
                      col === columns[0] && 'sticky left-0 z-10 bg-card',
                      priorityClass[col.priority],
                      col.className,
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

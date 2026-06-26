import type { ReactNode } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ResponsiveColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide on mobile card view */
  mobileHidden?: boolean;
  /** Promote as primary card title on mobile */
  mobilePrimary?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  /** Optional custom mobile card renderer; if absent, columns are stacked */
  mobileCard?: (row: T) => ReactNode;
  /** Tap action on mobile card */
  onRowClick?: (row: T) => void;
  emptyMessage?: ReactNode;
  className?: string;
}

export function ResponsiveTable<T>({
  columns,
  data,
  rowKey,
  mobileCard,
  onRowClick,
  emptyMessage = 'No records found.',
  className,
}: ResponsiveTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-10">{emptyMessage}</div>
    );
  }

  if (isMobile) {
    return (
      <div className={cn('space-y-3', className)}>
        {data.map((row) => (
          <Card
            key={rowKey(row)}
            onClick={() => onRowClick?.(row)}
            className={cn(
              'p-4 space-y-2',
              onRowClick && 'active:scale-[0.99] transition-transform cursor-pointer tap-target',
            )}
          >
            {mobileCard ? (
              mobileCard(row)
            ) : (
              <>
                {columns
                  .filter((c) => !c.mobileHidden)
                  .map((col) => (
                    <div
                      key={col.key}
                      className={cn(
                        'flex justify-between items-start gap-3 text-sm',
                        col.mobilePrimary && 'flex-col items-start gap-1',
                      )}
                    >
                      {!col.mobilePrimary && (
                        <span className="text-muted-foreground shrink-0">{col.header}</span>
                      )}
                      <div className={cn('text-right min-w-0', col.mobilePrimary && 'text-left font-semibold text-base')}>
                        {col.cell(row)}
                      </div>
                    </div>
                  ))}
              </>
            )}
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-border/40 overflow-x-auto', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer' : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
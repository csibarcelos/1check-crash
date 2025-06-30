
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../constants';
import { Button } from '@/components/ui/Button';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'; // Using Heroicons for pagination

const MotionTable = motion.table as any;
const MotionTbody = motion.tbody as any;
const MotionTr = motion.tr as any;

export interface TableHeader<T> {
  key: keyof T | string; 
  label: React.ReactNode;
  className?: string;
  renderCell?: (row: T, rowIndex: number) => React.ReactNode;
}

interface TableProps<T extends { id: string | number }> {
  headers: TableHeader<T>[];
  data: T[];
  rowKey: keyof T | ((row: T) => string | number); 
  onRowClick?: (row: T) => void;
  className?: string;
  tableClassName?: string;
  theadClassName?: string;
  tbodyClassName?: string;
  trClassName?: string;
  thClassName?: string;
  tdClassName?: string;
  emptyStateMessage?: React.ReactNode; // Changed from string to React.ReactNode
  isLoading?: boolean;
  
  // Pagination props
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number; // For display like "Showing 1-10 of 100"
  totalItems?: number;   // For display like "Showing 1-10 of 100"
}

const tableContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const tableRowVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: "circOut" as const } },
  exit: { opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.2, ease: "circIn" as const } },
};

export function Table<T extends { id: string | number }>({
  headers,
  data,
  rowKey,
  onRowClick,
  className,
  tableClassName,
  theadClassName,
  tbodyClassName,
  trClassName,
  thClassName,
  tdClassName,
  emptyStateMessage = "Nenhum dado encontrado.",
  isLoading = false,
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems,
}: TableProps<T>) {

  const getRowKey = (row: T): string | number => {
    if (typeof rowKey === 'function') {
      return rowKey(row);
    }
    return row[rowKey] as string | number;
  };

  const renderPaginationControls = () => {
    if (!currentPage || !totalPages || !onPageChange || totalPages <= 1) {
      return null;
    }

    const fromItem = Math.min((currentPage - 1) * (itemsPerPage || 10) + 1, totalItems || Infinity);
    const toItem = Math.min(currentPage * (itemsPerPage || 10), totalItems || Infinity);
    
    return (
      <div className="flex items-center justify-between mt-6 px-4 py-3 border-t border-border-subtle sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            variant="outline"
            size="sm"
          >
            Anterior
          </Button>
          <Button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            variant="outline"
            size="sm"
          >
            Próxima
          </Button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            {totalItems !== undefined && itemsPerPage !== undefined && totalItems > 0 ? (
                 <p className="text-sm text-text-muted">
                    Mostrando <span className="font-medium text-text-default">{fromItem}</span> a <span className="font-medium text-text-default">{toItem}</span> de <span className="font-medium text-text-default">{totalItems}</span> resultados
                </p>
            ) : (
                <p className="text-sm text-text-muted">
                    Página <span className="font-medium text-text-default">{currentPage}</span> de <span className="font-medium text-text-default">{totalPages}</span>
                </p>
            )}
          </div>
          <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px" aria-label="Paginação">
            <Button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              variant="ghost"
              size="sm"
              className="relative inline-flex items-center px-2 py-2 rounded-l-xl border border-border-subtle text-sm font-medium text-text-muted hover:bg-white/5"
            >
              <span className="sr-only">Anterior</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </Button>
            {/* Placeholder for page numbers if needed in future */}
            <span className="relative inline-flex items-center px-4 py-2 border border-border-subtle text-sm font-medium text-text-muted">
                {currentPage} / {totalPages}
            </span>
            <Button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              variant="ghost"
              size="sm"
              className="relative inline-flex items-center px-2 py-2 rounded-r-xl border border-border-subtle text-sm font-medium text-text-muted hover:bg-white/5"
            >
              <span className="sr-only">Próxima</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </Button>
          </nav>
        </div>
      </div>
    );
  };

  if (isLoading && data.length === 0) { // Show loading only if data is also empty
    return (
      <div className="flex justify-center items-center h-64 text-text-muted">
        Carregando dados da tabela...
      </div>
    );
  }
  
  if (!isLoading && data.length === 0) {
    return (
      <div className={cn("py-10 text-center text-text-muted", className)}>
        {emptyStateMessage}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <MotionTable
        className={cn("min-w-full divide-y divide-border-subtle", tableClassName)}
        initial="hidden"
        animate="show"
        variants={tableContainerVariants}
      >
        <thead className={cn("bg-bg-surface-opaque", theadClassName)}>
          <tr>
            {headers.map((header) => (
              <th
                key={String(header.key)}
                scope="col"
                className={cn(
                  "px-6 py-4 text-left text-xs font-semibold text-text-muted uppercase tracking-wider",
                  thClassName,
                  header.className
                )}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <MotionTbody
          className={cn("bg-transparent divide-y divide-border-subtle", tbodyClassName)}
          variants={tableContainerVariants} 
        >
          {data.map((row, rowIndex) => (
            <MotionTr
              key={getRowKey(row)}
              variants={tableRowVariants}
              layout
              className={cn(
                "transition-colors duration-150",
                onRowClick ? "cursor-pointer hover:bg-white/5" : "hover:bg-white/10",
                trClassName
              )}
              onClick={() => onRowClick?.(row)}
            >
              {headers.map((header) => (
                <td
                  key={`${String(header.key)}-${getRowKey(row)}`}
                  className={cn("px-6 py-4 whitespace-nowrap text-sm text-text-default", tdClassName)}
                >
                  {header.renderCell
                    ? header.renderCell(row, rowIndex)
                    : (row[header.key as keyof T] as React.ReactNode) ?? 'N/A'}
                </td>
              ))}
            </MotionTr>
          ))}
        </MotionTbody>
      </MotionTable>
      {renderPaginationControls()}
    </div>
  );
}

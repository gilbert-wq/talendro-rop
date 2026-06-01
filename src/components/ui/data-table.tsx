import React, { useState } from 'react'
import {
  useReactTable, getCoreRowModel, getFilteredRowModel,
  getPaginationRowModel, getSortedRowModel, flexRender,
  type ColumnDef, type SortingState, type ColumnFiltersState,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T>[]
  searchPlaceholder?: string
  searchKey?: string
}

export function DataTable<T>({ data, columns, searchPlaceholder = 'Search…', searchKey }: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, columnFilters, globalFilter },
    initialState: { pagination: { pageSize: 15 } },
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder={searchPlaceholder}
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="max-w-xs h-8 text-sm"
        />
        <div className="ml-auto text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} of {data.length} records
        </div>
      </div>

      <div className="table-container">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(header => (
                    <th key={header.id} className="text-left py-2.5 px-4 font-semibold text-xs text-muted-foreground whitespace-nowrap">
                      {header.isPlaceholder ? null : (
                        <button
                          className={cn("flex items-center gap-1 hover:text-foreground transition-colors", header.column.getCanSort() && "cursor-pointer")}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            header.column.getIsSorted() === 'asc' ? <ChevronUp className="h-3 w-3" /> :
                            header.column.getIsSorted() === 'desc' ? <ChevronDown className="h-3 w-3" /> :
                            <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-muted-foreground text-sm">
                    No records found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row, i) => (
                  <tr key={row.id} className={cn("border-b last:border-0 hover:bg-muted/30 transition-colors", i % 2 === 0 ? '' : 'bg-muted/10')}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="py-2.5 px-4 text-sm">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="h-7 px-2">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="h-7 px-2">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

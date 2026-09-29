/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DataTablePagination,
  DataTableView,
  useDataTable,
} from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatTimestampToDate } from '@/lib/format'
import { getServerErrorSources } from '@/lib/server-error-message'

import { getEligibleInvoiceOrders } from '../api'
import type { InvoiceOrder } from '../types'
import { InvoiceAmount } from './invoice-display'

const EMPTY_ORDERS: InvoiceOrder[] = []

export function OrderPicker(props: {
  selected: InvoiceOrder[]
  onChange: (orders: InvoiceOrder[]) => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const orders = useQuery({
    queryKey: ['invoices', 'eligible', pagination],
    queryFn: () =>
      getEligibleInvoiceOrders(pagination.pageIndex + 1, pagination.pageSize),
  })
  const invoiceDisabled = getServerErrorSources(orders.error).some(
    (source) => source.code === 'INVOICE_DISABLED'
  )
  useEffect(() => {
    if (invoiceDisabled) {
      void queryClient.invalidateQueries({ queryKey: ['status'] })
    }
  }, [invoiceDisabled, queryClient])
  const columns: ColumnDef<InvoiceOrder>[] = [
    {
      id: 'select',
      header: t('Select'),
      size: 48,
      cell: ({ row }) => {
        const selected = props.selected.some(
          (order) => order.top_up_id === row.original.top_up_id
        )
        return (
          <Checkbox
            aria-label={t('Select order {{number}}', {
              number: row.original.trade_no,
            })}
            checked={selected}
            disabled={
              props.disabled || (!selected && props.selected.length >= 100)
            }
            onCheckedChange={(checked) =>
              props.onChange(
                checked
                  ? [...props.selected, row.original]
                  : props.selected.filter(
                      (order) => order.top_up_id !== row.original.top_up_id
                    )
              )
            }
          />
        )
      },
    },
    {
      accessorKey: 'trade_no',
      header: t('Order number'),
      cell: ({ row }) => (
        <span className='break-all'>{row.original.trade_no}</span>
      ),
    },
    {
      accessorKey: 'amount_minor',
      header: t('Paid amount'),
      cell: ({ row }) => (
        <InvoiceAmount
          minor={row.original.amount_minor}
          currency={row.original.currency}
        />
      ),
    },
    {
      accessorKey: 'paid_at',
      header: t('Payment time'),
      cell: ({ row }) => formatTimestampToDate(row.original.paid_at),
    },
  ]
  const { table } = useDataTable({
    data: orders.data?.items ?? EMPTY_ORDERS,
    columns,
    pagination,
    onPaginationChange: setPagination,
    manualPagination: true,
    totalCount: orders.data?.total ?? 0,
    getRowId: (row) => String(row.top_up_id),
  })
  const total = props.selected.reduce(
    (sum, order) => sum + order.amount_minor,
    0
  )

  return (
    <section
      className='min-w-0 space-y-3'
      aria-label={t('Eligible recharge orders')}
      aria-busy={orders.isFetching}
    >
      {orders.isError ? (
        <ErrorState onRetry={() => void orders.refetch()} />
      ) : (
        <>
          <DataTableView
            table={table}
            isLoading={orders.isPending}
            tableContainerClassName='overflow-x-auto'
            tableClassName='min-w-[520px]'
            emptyContent={
              <EmptyState
                title={t('No eligible recharge orders')}
                description={t(
                  'Only the eligible recharge orders listed in the application can be invoiced. Rewards, redemption codes and subscription purchases are excluded.'
                )}
              />
            }
          />
          <DataTablePagination table={table} compact />
        </>
      )}
      <div className='flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm'>
        <span aria-live='polite'>
          {t('Selected {{count}} orders', { count: props.selected.length })} ·{' '}
          <InvoiceAmount minor={total} currency='CNY' />
        </span>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          disabled={props.disabled || !props.selected.length}
          onClick={() => props.onChange([])}
        >
          {t('Clear selection')}
        </Button>
      </div>
    </section>
  )
}

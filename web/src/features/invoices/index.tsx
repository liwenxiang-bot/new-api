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
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { useStatus } from '@/hooks/use-status'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

import { getInvoices } from './api'
import { ApplicationDialog } from './components/application-dialog'
import { InvoiceApplicationGuide } from './components/application-guide'
import { DetailDialog } from './components/detail-dialog'
import { InvoiceAmount, InvoiceStatusBadge } from './components/invoice-display'
import type { Invoice, InvoiceStatus } from './types'

const EMPTY_INVOICES: Invoice[] = []

export function Invoices(props: { admin?: boolean }) {
  const { t } = useTranslation()
  const admin = props.admin === true
  const { status: systemStatus } = useStatus()
  const invoiceEnabled = systemStatus?.invoice_enabled === true
  const configuredMinimum = systemStatus?.invoice_min_amount_minor
  const minAmountMinor =
    typeof configuredMinimum === 'number' &&
    Number.isSafeInteger(configuredMinimum) &&
    configuredMinimum >= 0 &&
    configuredMinimum <= 1e12
      ? configuredMinimum
      : 50000
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })
  const [status, setStatus] = useState<InvoiceStatus | ''>('')
  const [applicationOpen, setApplicationOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const query = useQuery({
    queryKey: ['invoices', admin, 'list', pagination, status],
    queryFn: () =>
      getInvoices(admin, pagination.pageIndex + 1, pagination.pageSize, status),
  })
  const columns = useMemo<ColumnDef<Invoice>[]>(() => {
    const result: ColumnDef<Invoice>[] = [
      { accessorKey: 'id', header: t('Application ID') },
      { accessorKey: 'title', header: t('Invoice title') },
      {
        accessorKey: 'amount_minor',
        header: t('Amount'),
        cell: ({ row }) => (
          <InvoiceAmount
            minor={row.original.amount_minor}
            currency={row.original.currency}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: t('Status'),
        cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: 'created_at',
        header: t('Application time'),
        cell: ({ row }) => formatTimestampToDate(row.original.created_at),
      },
      {
        id: 'actions',
        header: t('Actions'),
        cell: ({ row }) => (
          <Button
            variant='outline'
            size='sm'
            onClick={() => setDetailId(row.original.id)}
          >
            {t('View details')}
          </Button>
        ),
      },
    ]
    if (admin) {
      result.splice(1, 0, { accessorKey: 'user_id', header: t('User ID') })
    }
    return result
  }, [t, admin])
  const { table } = useDataTable({
    data: query.data?.items ?? EMPTY_INVOICES,
    columns,
    pagination,
    onPaginationChange: setPagination,
    manualPagination: true,
    totalCount: query.data?.total ?? 0,
    getRowId: (invoice) => String(invoice.id),
  })
  let emptyDescription: string | undefined
  if (admin) {
    emptyDescription = t('User invoice applications will appear here.')
  } else if (invoiceEnabled) {
    emptyDescription = t(
      'Select eligible recharge orders to submit your first invoice application.'
    )
  }
  return (
    <>
      <SectionPageLayout fixedContent={admin}>
        <SectionPageLayout.Title>
          {admin ? t('Invoice management') : t('Invoices')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          {!admin && (
            <Button
              onClick={() => setApplicationOpen(true)}
              disabled={!invoiceEnabled}
            >
              <Plus aria-hidden='true' />
              {t('Apply for an invoice')}
            </Button>
          )}
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <div
            className={cn(
              'flex min-w-0 flex-col gap-5',
              admin ? 'h-full min-h-0' : 'mx-auto w-full max-w-7xl'
            )}
          >
            {!admin && !invoiceEnabled && (
              <Alert>
                <AlertDescription>
                  {t(
                    'Invoice applications are currently unavailable. You can still view existing applications and download issued invoices.'
                  )}
                </AlertDescription>
              </Alert>
            )}
            {admin ? (
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Review invoice applications and upload invoices issued by your invoicing system.'
                )}
              </p>
            ) : null}
            {!admin && invoiceEnabled ? (
              <InvoiceApplicationGuide minAmountMinor={minAmountMinor} />
            ) : null}
            <section
              aria-label={t('Invoice applications')}
              className={cn(
                'flex min-w-0 flex-col gap-3',
                admin && 'min-h-0 flex-1'
              )}
            >
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <h3 className='text-sm font-semibold'>
                  {t('Invoice applications')}
                </h3>
                <NativeSelect
                  aria-label={t('Invoice status')}
                  className='w-full sm:w-44'
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as InvoiceStatus | '')
                    setPagination((previous) => ({ ...previous, pageIndex: 0 }))
                  }}
                >
                  <NativeSelectOption value=''>
                    {t('All statuses')}
                  </NativeSelectOption>
                  <NativeSelectOption value='pending'>
                    {t('Pending review')}
                  </NativeSelectOption>
                  <NativeSelectOption value='approved'>
                    {t('Awaiting invoice')}
                  </NativeSelectOption>
                  <NativeSelectOption value='rejected'>
                    {t('Rejected')}
                  </NativeSelectOption>
                  <NativeSelectOption value='issued'>
                    {t('Invoice issued')}
                  </NativeSelectOption>
                </NativeSelect>
              </div>
              {query.isError ? (
                <ErrorState onRetry={() => void query.refetch()} />
              ) : (
                <div className={cn('min-w-0', admin && 'min-h-0 flex-1')}>
                  <DataTablePage
                    table={table}
                    columns={columns}
                    isLoading={query.isPending}
                    isFetching={query.isFetching}
                    toolbarProps={null}
                    fixedHeight={admin}
                    paginationInFooter={admin}
                    emptyTitle={t('No invoice applications')}
                    emptyDescription={emptyDescription}
                  />
                </div>
              )}
            </section>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>
      {applicationOpen && (
        <ApplicationDialog
          enabled={invoiceEnabled}
          minAmountMinor={minAmountMinor}
          onClose={() => setApplicationOpen(false)}
        />
      )}
      {detailId !== null && (
        <DetailDialog
          key={detailId}
          id={detailId}
          admin={admin}
          onClose={() => setDetailId(null)}
        />
      )}
    </>
  )
}

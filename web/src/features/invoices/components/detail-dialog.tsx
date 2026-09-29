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
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'

import { downloadInvoice, getInvoice } from '../api'
import { InvoiceAmount, InvoiceStatusBadge } from './invoice-display'
import { IssueDialog } from './issue-dialog'
import { ReviewDialog } from './review-dialog'

export function DetailDialog(props: {
  id: number
  admin: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [action, setAction] = useState<'approve' | 'reject' | 'issue' | null>(
    null
  )
  const query = useQuery({
    queryKey: ['invoices', props.admin, 'detail', props.id],
    queryFn: () => getInvoice(props.admin, props.id),
  })
  const download = useMutation({
    mutationFn: () => downloadInvoice(props.admin, props.id),
  })
  const invoice = query.data
  const fields = invoice
    ? [
        [t('Application ID'), String(invoice.id)],
        [t('User ID'), String(invoice.user_id)],
        [t('Invoice title'), invoice.title],
        [
          t('Title type'),
          invoice.title_type === 'company' ? t('Company') : t('Personal'),
        ],
        [
          t('Invoice type'),
          invoice.invoice_type === 'special'
            ? t('Special VAT invoice')
            : t('Ordinary VAT invoice'),
        ],
        [t('Taxpayer ID'), invoice.tax_id],
        [t('Contact email'), invoice.email],
        [t('Registered address'), invoice.address],
        [t('Contact phone'), invoice.phone],
        [t('Bank name'), invoice.bank_name],
        [t('Bank account'), invoice.bank_account],
        [t('Remarks'), invoice.remark],
        [t('Application time'), formatTimestampToDate(invoice.created_at)],
        [t('Review time'), formatTimestampToDate(invoice.reviewed_at)],
        [t('Invoice number'), invoice.invoice_number],
        [t('Issued at'), formatTimestampToDate(invoice.issued_at)],
      ]
    : []

  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open && !action) props.onClose()
        }}
        title={t('Invoice details')}
        contentClassName='sm:max-w-3xl'
        bodyClassName='space-y-5'
        footer={
          invoice && (
            <>
              {invoice.status === 'issued' && (
                <Button
                  disabled={download.isPending}
                  onClick={() => download.mutate()}
                >
                  {t('Download invoice')}
                </Button>
              )}
              {props.admin && invoice.status === 'pending' && (
                <Button onClick={() => setAction('approve')}>
                  {t('Approve')}
                </Button>
              )}
              {props.admin &&
                (invoice.status === 'pending' ||
                  invoice.status === 'approved') && (
                  <Button
                    variant='destructive'
                    onClick={() => setAction('reject')}
                  >
                    {t('Reject')}
                  </Button>
                )}
              {props.admin && invoice.status === 'approved' && (
                <Button onClick={() => setAction('issue')}>
                  {t('Upload issued invoice')}
                </Button>
              )}
              <Button variant='outline' onClick={props.onClose}>
                {t('Close')}
              </Button>
            </>
          )
        }
      >
        {query.isPending && <LoadingState />}
        {query.isError && <ErrorState onRetry={() => void query.refetch()} />}
        {invoice && (
          <>
            <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4'>
              <InvoiceStatusBadge status={invoice.status} />
              <span className='text-lg font-semibold'>
                <InvoiceAmount
                  minor={invoice.amount_minor}
                  currency={invoice.currency}
                />
              </span>
            </div>
            {invoice.rejection_reason && (
              <Alert variant='destructive'>
                <AlertTitle>{t('Rejection reason')}</AlertTitle>
                <AlertDescription className='break-all whitespace-pre-wrap'>
                  {invoice.rejection_reason}
                </AlertDescription>
              </Alert>
            )}
            <dl className='grid gap-4 text-sm sm:grid-cols-2'>
              {fields
                .filter(([, value]) => !!value)
                .map(([label, value]) => (
                  <div key={label} className='min-w-0'>
                    <dt className='text-muted-foreground mb-1'>{label}</dt>
                    <dd className='break-all whitespace-pre-wrap'>{value}</dd>
                  </div>
                ))}
            </dl>
            <StaticDataTable
              data={invoice.orders ?? []}
              getRowKey={(order) => order.top_up_id}
              columns={[
                {
                  id: 'number',
                  header: t('Order number'),
                  cell: (order) => order.trade_no,
                },
                {
                  id: 'amount',
                  header: t('Paid amount'),
                  cell: (order) => (
                    <InvoiceAmount
                      minor={order.amount_minor}
                      currency={order.currency}
                    />
                  ),
                },
                {
                  id: 'paid',
                  header: t('Payment time'),
                  cell: (order) => formatTimestampToDate(order.paid_at),
                },
              ]}
            />
          </>
        )}
      </Dialog>
      {(action === 'approve' || action === 'reject') && (
        <ReviewDialog
          id={props.id}
          approve={action === 'approve'}
          onClose={() => setAction(null)}
        />
      )}
      {action === 'issue' && (
        <IssueDialog id={props.id} onClose={() => setAction(null)} />
      )}
    </>
  )
}

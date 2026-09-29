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
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { handleServerError } from '@/lib/handle-server-error'
import { getServerErrorSources } from '@/lib/server-error-message'

import { createInvoice } from '../api'
import { invoiceApplicationSchema } from '../lib/validation'
import type { InvoiceApplicationRequest, InvoiceOrder } from '../types'
import { ApplicationFields } from './application-fields'
import { InvoiceAmount } from './invoice-display'
import { OrderPicker } from './order-picker'

export function ApplicationDialog(props: {
  enabled?: boolean
  minAmountMinor?: number
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const guidanceRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<InvoiceOrder[]>([])
  const form = useForm<InvoiceApplicationRequest>({
    resolver: zodResolver(invoiceApplicationSchema(t)),
    defaultValues: {
      top_up_ids: [],
      invoice_type: 'ordinary',
      title_type: 'personal',
      title: '',
      tax_id: '',
      email: '',
      address: '',
      phone: '',
      bank_name: '',
      bank_account: '',
      remark: '',
    },
  })
  const mutation = useMutation({
    mutationFn: createInvoice,
    onError: (error) => {
      if (
        getServerErrorSources(error).some(
          (source) =>
            source.code === 'INVOICE_DISABLED' ||
            source.code === 'INVOICE_BELOW_MINIMUM'
        )
      ) {
        void queryClient.invalidateQueries({ queryKey: ['status'] })
      }
      handleServerError(error)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(t('Invoice application submitted'))
      props.onClose()
    },
  })
  const amount = selected.reduce((sum, order) => sum + order.amount_minor, 0)
  const disabled = props.enabled === false || mutation.isPending
  const minAmountMinor = props.minAmountMinor ?? 50000
  const belowMinimum = amount < minAmountMinor
  const canSubmit =
    !disabled &&
    selected.length > 0 &&
    Number.isSafeInteger(amount) &&
    amount <= 1e12 &&
    !belowMinimum

  return (
    <Dialog
      open
      initialFocus={guidanceRef}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) props.onClose()
      }}
      title={t('Apply for an invoice')}
      description={t(
        'Select recharge orders and enter the details that should appear on your invoice.'
      )}
      contentClassName='sm:max-w-3xl'
      bodyClassName='space-y-5'
      footer={
        <>
          <Button
            variant='outline'
            disabled={mutation.isPending}
            onClick={props.onClose}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='invoice-application'
            disabled={!canSubmit}
          >
            {mutation.isPending ? t('Submitting...') : t('Submit application')}
          </Button>
        </>
      }
    >
      {props.enabled === false && (
        <Alert>
          <AlertDescription>
            {t(
              'Invoice applications are currently unavailable. You can still view existing applications and download issued invoices.'
            )}
          </AlertDescription>
        </Alert>
      )}
      <Alert
        ref={guidanceRef}
        tabIndex={-1}
        role='note'
        className='bg-muted/30 outline-none'
      >
        <Info aria-hidden='true' />
        <AlertDescription>
          {t(
            'Only the eligible recharge orders listed in the application can be invoiced. Rewards, redemption codes and subscription purchases are excluded.'
          )}
        </AlertDescription>
      </Alert>
      <p className='text-sm'>
        {minAmountMinor > 0 ? (
          <>
            {t('Minimum invoice amount')}:{' '}
            <InvoiceAmount minor={minAmountMinor} currency='CNY' />
          </>
        ) : (
          t('No minimum invoice amount')
        )}
        {minAmountMinor > 0 && (
          <span className='text-muted-foreground mt-1 block'>
            {t('Combine eligible recharge orders to reach this amount.')}
          </span>
        )}
      </p>
      <Form {...form}>
        <form
          id='invoice-application'
          className='space-y-5'
          onSubmit={form.handleSubmit((values) => {
            if (canSubmit) mutation.mutate(values)
          })}
          noValidate
        >
          <OrderPicker
            selected={selected}
            disabled={disabled}
            onChange={(orders) => {
              setSelected(orders)
              form.setValue(
                'top_up_ids',
                orders.map((order) => order.top_up_id),
                { shouldValidate: true }
              )
            }}
          />
          <FieldError errors={[form.formState.errors.top_up_ids]} />
          {(!Number.isSafeInteger(amount) || amount > 1e12) && (
            <FieldError>
              {t('The selected amount is too large. Select fewer orders.')}
            </FieldError>
          )}
          {selected.length > 0 && belowMinimum && (
            <FieldError>
              {t('The selected total is below the minimum invoice amount.')}
            </FieldError>
          )}
          <ApplicationFields disabled={disabled} />
        </form>
      </Form>
    </Dialog>
  )
}

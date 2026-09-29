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
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

import { reviewInvoice } from '../api'

export function ReviewDialog(props: {
  id: number
  approve: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<{ reason: string }>({
    resolver: zodResolver(
      z.object({
        reason: z
          .string()
          .trim()
          .min(props.approve ? 0 : 1, t('A rejection reason is required'))
          .max(
            1000,
            t('Use no more than {{count}} characters', { count: 1000 })
          ),
      })
    ),
    defaultValues: { reason: '' },
  })
  const mutation = useMutation({
    mutationFn: (values: { reason: string }) =>
      reviewInvoice(props.id, props.approve, values.reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(t('Invoice application updated'))
      props.onClose()
    },
  })
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) props.onClose()
      }}
      title={
        props.approve
          ? t('Approve invoice application')
          : t('Reject invoice application')
      }
      desc={
        props.approve
          ? t(
              'Confirm that the recharge orders and invoice details have been verified. You can upload the issued invoice after approval.'
            )
          : t(
              'Explain why this application was rejected. The user can apply again with these recharge orders.'
            )
      }
      confirmText={props.approve ? t('Approve') : t('Reject')}
      destructive={!props.approve}
      isLoading={mutation.isPending}
      handleConfirm={form.handleSubmit((values) => mutation.mutate(values))}
    >
      {!props.approve && (
        <Field data-invalid={!!form.formState.errors.reason}>
          <FieldLabel htmlFor='invoice-rejection'>
            {t('Rejection reason')}
          </FieldLabel>
          <Textarea
            id='invoice-rejection'
            maxLength={1000}
            disabled={mutation.isPending}
            aria-invalid={!!form.formState.errors.reason}
            {...form.register('reason')}
          />
          <FieldError errors={[form.formState.errors.reason]} />
        </Field>
      )}
    </ConfirmDialog>
  )
}

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
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import { issueInvoice } from '../api'
import { invoiceIssueSchema } from '../lib/validation'

export function IssueDialog(props: { id: number; onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<{ invoice_number: string; file: File }>({
    resolver: zodResolver(invoiceIssueSchema(t)),
    defaultValues: { invoice_number: '' },
  })
  const mutation = useMutation({
    mutationFn: (values: { invoice_number: string; file: File }) =>
      issueInvoice(props.id, values.file, values.invoice_number),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(t('Invoice uploaded'))
      props.onClose()
    },
  })
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) props.onClose()
      }}
      title={t('Upload issued invoice')}
      description={t(
        'Upload the PDF issued by your invoicing system. The user will be able to download it. Issued invoices cannot be replaced here.'
      )}
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
            form='invoice-issue'
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t('Uploading...') : t('Upload invoice')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='invoice-issue'
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.invoice_number}>
              <FieldLabel htmlFor='invoice-number'>
                {t('Invoice number')}
              </FieldLabel>
              <Input
                id='invoice-number'
                maxLength={100}
                disabled={mutation.isPending}
                aria-invalid={!!form.formState.errors.invoice_number}
                {...form.register('invoice_number')}
              />
              <FieldError errors={[form.formState.errors.invoice_number]} />
            </Field>
            <Field data-invalid={!!form.formState.errors.file}>
              <FieldLabel htmlFor='invoice-file'>{t('Invoice PDF')}</FieldLabel>
              <Controller
                control={form.control}
                name='file'
                render={({ field }) => (
                  <Input
                    id='invoice-file'
                    type='file'
                    accept='.pdf,application/pdf'
                    disabled={mutation.isPending}
                    aria-invalid={!!form.formState.errors.file}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(event.target.files?.[0])
                    }
                  />
                )}
              />
              <FieldDescription>{t('PDF only, up to 5 MiB')}</FieldDescription>
              <FieldError errors={[form.formState.errors.file]} />
            </Field>
          </FieldGroup>
        </form>
      </Form>
    </Dialog>
  )
}

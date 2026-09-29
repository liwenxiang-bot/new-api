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
import { useFormContext, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'

import type { InvoiceApplicationRequest } from '../types'
import { InvoiceQuickFill } from './quick-fill'

export function ApplicationFields(props: { disabled: boolean }) {
  const { t } = useTranslation()
  const form = useFormContext<InvoiceApplicationRequest>()
  const titleType = useWatch({ control: form.control, name: 'title_type' })
  const fields = [
    { name: 'title', label: t('Invoice title'), max: 200, required: true },
    {
      name: 'tax_id',
      label: t('Taxpayer ID'),
      max: 32,
      required: titleType === 'company',
    },
    {
      name: 'email',
      label: t('Contact email'),
      max: 254,
      required: true,
      type: 'email',
    },
    { name: 'address', label: t('Registered address'), max: 500 },
    { name: 'phone', label: t('Contact phone'), max: 50 },
    { name: 'bank_name', label: t('Bank name'), max: 200 },
    { name: 'bank_account', label: t('Bank account'), max: 100 },
  ] as const

  return (
    <FieldGroup className='grid gap-4 sm:grid-cols-2'>
      <InvoiceQuickFill disabled={props.disabled} />
      <Field>
        <FieldLabel htmlFor='invoice-title-type'>{t('Title type')}</FieldLabel>
        <NativeSelect
          id='invoice-title-type'
          className='w-full'
          disabled={props.disabled}
          {...form.register('title_type', {
            onChange: (event) => {
              if (event.target.value === 'personal') {
                form.setValue('invoice_type', 'ordinary')
                form.setValue('tax_id', '')
                form.clearErrors(['invoice_type', 'tax_id'])
              }
            },
          })}
        >
          <NativeSelectOption value='personal'>
            {t('Personal')}
          </NativeSelectOption>
          <NativeSelectOption value='company'>
            {t('Company')}
          </NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field data-invalid={!!form.formState.errors.invoice_type}>
        <FieldLabel htmlFor='invoice-type'>{t('Invoice type')}</FieldLabel>
        <NativeSelect
          id='invoice-type'
          className='w-full'
          disabled={props.disabled}
          aria-invalid={!!form.formState.errors.invoice_type}
          {...form.register('invoice_type')}
        >
          <NativeSelectOption value='ordinary'>
            {t('Ordinary VAT invoice')}
          </NativeSelectOption>
        </NativeSelect>
        <FieldError errors={[form.formState.errors.invoice_type]} />
      </Field>
      {fields.map((field) => {
        if (field.name === 'tax_id' && titleType !== 'company') return null
        const error = form.formState.errors[field.name]
        const required = 'required' in field && field.required
        return (
          <Field key={field.name} data-invalid={!!error}>
            <FieldLabel htmlFor={`invoice-${field.name}`}>
              {field.label}
              {required ? ' *' : null}
            </FieldLabel>
            <Input
              id={`invoice-${field.name}`}
              type={'type' in field ? field.type : 'text'}
              maxLength={field.max}
              aria-required={required}
              aria-invalid={!!error}
              aria-describedby={
                error ? `invoice-${field.name}-error` : undefined
              }
              disabled={props.disabled}
              {...form.register(field.name)}
            />
            <FieldError id={`invoice-${field.name}-error`} errors={[error]} />
          </Field>
        )
      })}
      <Field
        className='sm:col-span-2'
        data-invalid={!!form.formState.errors.remark}
      >
        <FieldLabel htmlFor='invoice-remark'>{t('Remarks')}</FieldLabel>
        <Textarea
          id='invoice-remark'
          maxLength={1000}
          disabled={props.disabled}
          aria-invalid={!!form.formState.errors.remark}
          {...form.register('remark')}
        />
        <FieldError errors={[form.formState.errors.remark]} />
      </Field>
    </FieldGroup>
  )
}

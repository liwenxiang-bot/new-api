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
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

import { parseInvoiceDetails, type InvoiceDetailField } from '../lib/quick-fill'
import type { InvoiceApplicationRequest } from '../types'

export function InvoiceQuickFill(props: { disabled: boolean }) {
  const { t } = useTranslation()
  const form = useFormContext<InvoiceApplicationRequest>()
  const [text, setText] = useState('')
  const [result, setResult] = useState<'idle' | 'filled' | 'unrecognized'>(
    'idle'
  )

  return (
    <Field className='sm:col-span-2' data-invalid={result === 'unrecognized'}>
      <FieldLabel htmlFor='invoice-quick-fill'>
        {t('Quick fill invoice details')}
      </FieldLabel>
      <Textarea
        id='invoice-quick-fill'
        value={text}
        maxLength={6000}
        rows={3}
        disabled={props.disabled}
        aria-invalid={result === 'unrecognized'}
        aria-describedby='invoice-quick-fill-hint invoice-quick-fill-result'
        onChange={(event) => {
          setText(event.target.value)
          setResult('idle')
        }}
      />
      <FieldDescription id='invoice-quick-fill-hint'>
        {t(
          'Paste Chinese or English field labels, one per line. Matching fields will be replaced; review them before submitting.'
        )}
      </FieldDescription>
      <div>
        <Button
          type='button'
          variant='outline'
          disabled={props.disabled || !text.trim()}
          onClick={() => {
            const parsed = parseInvoiceDetails(text)
            const fields = Object.keys(parsed.fields) as InvoiceDetailField[]
            if (fields.length === 0) {
              setResult('unrecognized')
              return
            }
            if (parsed.company) {
              form.setValue('title_type', 'company', { shouldDirty: true })
            }
            for (const field of fields) {
              const value = parsed.fields[field]
              if (value === undefined) continue
              form.setValue(field, value, {
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            void form.trigger(fields)
            setResult('filled')
          }}
        >
          {t('Recognize and fill')}
        </Button>
      </div>
      <div id='invoice-quick-fill-result' role='status' aria-live='polite'>
        {result === 'filled' && (
          <FieldDescription>
            {t('Details filled in. Check the fields below before submitting.')}
          </FieldDescription>
        )}
        {result === 'unrecognized' && (
          <FieldError>
            {t(
              'No invoice fields recognized. Use one label and value per line, separated by a colon.'
            )}
          </FieldError>
        )}
      </div>
    </Field>
  )
}

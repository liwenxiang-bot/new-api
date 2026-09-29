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
import type { TFunction } from 'i18next'
import { z } from 'zod'

export const MAX_INVOICE_FILE_BYTES = 5 * 1024 * 1024

export function invoiceApplicationSchema(t: TFunction) {
  return z
    .object({
      top_up_ids: z
        .array(z.number().int().positive())
        .min(1, t('Select at least one recharge order'))
        .max(100, t('Select no more than 100 recharge orders')),
      invoice_type: z.literal('ordinary', {
        error: t('Only ordinary VAT invoices are currently supported'),
      }),
      title_type: z.enum(['personal', 'company']),
      title: z
        .string()
        .trim()
        .min(1, t('Invoice title is required'))
        .max(200, t('Invoice title is too long')),
      tax_id: z.string().trim().max(32, t('Enter a valid taxpayer ID')),
      email: z
        .email(t('Enter a valid email address'))
        .max(254, t('Use no more than {{count}} characters', { count: 254 })),
      address: z
        .string()
        .trim()
        .max(500, t('Use no more than {{count}} characters', { count: 500 })),
      phone: z
        .string()
        .trim()
        .max(50, t('Use no more than {{count}} characters', { count: 50 })),
      bank_name: z
        .string()
        .trim()
        .max(200, t('Use no more than {{count}} characters', { count: 200 })),
      bank_account: z
        .string()
        .trim()
        .max(100, t('Use no more than {{count}} characters', { count: 100 })),
      remark: z
        .string()
        .trim()
        .max(1000, t('Use no more than {{count}} characters', { count: 1000 })),
    })
    .superRefine((value, context) => {
      if (
        value.title_type === 'company' &&
        !/^[a-zA-Z0-9]{15,20}$/.test(value.tax_id)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['tax_id'],
          message: t('Enter a taxpayer ID of 15 to 20 letters or digits'),
        })
      }
      if (new Set(value.top_up_ids).size !== value.top_up_ids.length) {
        context.addIssue({
          code: 'custom',
          path: ['top_up_ids'],
          message: t('Select each recharge order only once'),
        })
      }
    })
}

export function invoiceIssueSchema(t: TFunction) {
  return z.object({
    invoice_number: z
      .string()
      .trim()
      .min(1, t('Invoice number is required'))
      .max(100, t('Use no more than {{count}} characters', { count: 100 })),
    file: z
      .custom<File>((file) => file instanceof File, t('Select an invoice PDF'))
      .refine(
        (file) =>
          !(file instanceof File) ||
          (file.size > 0 && file.size <= MAX_INVOICE_FILE_BYTES),
        t('The invoice PDF must be between 1 byte and 5 MiB')
      )
      .refine(
        (file) =>
          !(file instanceof File) ||
          (file.name.toLowerCase().endsWith('.pdf') &&
            (!file.type || file.type === 'application/pdf')),
        t('Only PDF invoices are supported')
      ),
  })
}

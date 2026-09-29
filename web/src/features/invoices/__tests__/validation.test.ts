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
import i18next from 'i18next'
import { describe, expect, test } from 'vitest'

import { parseInvoiceDetails } from '../lib/quick-fill'
import {
  invoiceApplicationSchema,
  invoiceIssueSchema,
  MAX_INVOICE_FILE_BYTES,
} from '../lib/validation'

const validApplication = {
  top_up_ids: [11],
  invoice_type: 'ordinary' as const,
  title_type: 'personal' as const,
  title: 'Example',
  tax_id: '',
  email: 'buyer@example.com',
  address: '',
  phone: '',
  bank_name: '',
  bank_account: '',
  remark: '',
}

describe('invoice application validation', () => {
  test('personal ordinary invoices accept a title and contact email without a tax ID', () => {
    expect(invoiceApplicationSchema(i18next.t).parse(validApplication)).toEqual(
      validApplication
    )
  })
  test.each([
    ['no orders', { top_up_ids: [] }],
    ['duplicate order', { top_up_ids: [11, 11] }],
    ['company without tax ID', { title_type: 'company' }],
    [
      'invalid company tax ID',
      { title_type: 'company', tax_id: '1234567890中文中文中文' },
    ],
    ['empty title', { title: '  ' }],
    ['overlong title', { title: 'A'.repeat(201) }],
    ['invalid email', { email: 'invalid' }],
  ])('rejects %s before submission', (_, overrides) => {
    expect(
      invoiceApplicationSchema(i18next.t).safeParse({
        ...validApplication,
        ...overrides,
      }).success
    ).toBe(false)
  })
  test('company ordinary invoice accepts a valid tax ID and multiple distinct orders', () => {
    expect(
      invoiceApplicationSchema(i18next.t).safeParse({
        ...validApplication,
        top_up_ids: [11, 12],
        title_type: 'company',
        invoice_type: 'ordinary',
        tax_id: '91310000MA12345678',
      }).success
    ).toBe(true)
  })
  test.each(['personal', 'company'])(
    'rejects a special VAT invoice with a valid %s title before submission',
    (titleType) => {
      const result = invoiceApplicationSchema(i18next.t).safeParse({
        ...validApplication,
        title_type: titleType,
        invoice_type: 'special',
        tax_id: '91310000MA12345678',
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues).toContainEqual(
        expect.objectContaining({
          path: ['invoice_type'],
          message: 'Only ordinary VAT invoices are currently supported',
        })
      )
    }
  )
})

describe('invoice upload validation', () => {
  test.each([
    ['missing file', undefined],
    ['empty PDF', new File([], 'empty.pdf', { type: 'application/pdf' })],
    ['non-PDF', new File(['x'], 'document.html', { type: 'text/html' })],
    [
      'oversized PDF',
      new File([new Uint8Array(MAX_INVOICE_FILE_BYTES + 1)], 'large.pdf', {
        type: 'application/pdf',
      }),
    ],
  ])('rejects %s before uploading', (_, file) => {
    expect(
      invoiceIssueSchema(i18next.t).safeParse({ invoice_number: 'INV-1', file })
        .success
    ).toBe(false)
  })
  test('accepts a nonempty PDF with an invoice number', () => {
    const file = new File(['%PDF-1.7'], 'invoice.pdf', {
      type: 'application/pdf',
    })
    expect(
      invoiceIssueSchema(i18next.t).parse({ invoice_number: ' INV-1 ', file })
    ).toEqual({ invoice_number: 'INV-1', file })
  })
})

describe('invoice quick fill parsing', () => {
  test('recognizes labeled company details and preserves long account numbers as strings', () => {
    expect(
      parseInvoiceDetails(`单位名称：示例科技有限公司
纳税人识别号：91330000MA12345678
地址：示例市测试路 123 号
开户银行：示例银行测试支行
账号：0012345678901234567890
联系电话：0571-12345678`)
    ).toEqual({
      fields: {
        title: '示例科技有限公司',
        tax_id: '91330000MA12345678',
        address: '示例市测试路 123 号',
        bank_name: '示例银行测试支行',
        bank_account: '0012345678901234567890',
        phone: '0571-12345678',
      },
      company: true,
    })
  })

  test('supports aliases, Windows newlines, colon styles and whitespace around identifiers', () => {
    expect(
      parseInvoiceDetails(
        '公司名称 : Example Ltd\r\n统一社会信用代码: 9133 0000 ma12345678\r\n开户行：Example Bank\r\n银行账号 : 0012 3456 7890\r\n电子邮箱: billing@example.com'
      )
    ).toEqual({
      fields: {
        title: 'Example Ltd',
        tax_id: '91330000MA12345678',
        bank_name: 'Example Bank',
        bank_account: '001234567890',
        email: 'billing@example.com',
      },
      company: true,
    })
  })

  test('generic titles and contact details do not force a company title', () => {
    expect(
      parseInvoiceDetails(
        'Invoice title: Example Buyer\nContact phone: +1 202 555 0100\nContact email: buyer@example.com'
      )
    ).toEqual({
      fields: {
        title: 'Example Buyer',
        phone: '+1 202 555 0100',
        email: 'buyer@example.com',
      },
      company: false,
    })
  })

  test('ignores empty and unknown labels without splitting labels embedded in values', () => {
    expect(
      parseInvoiceDetails(
        '说明：联系电话：1234\nconstructor: ignored\n税号：  \n地址：测试路 1 号，电话：1234\n未标注的内容'
      )
    ).toEqual({
      fields: { address: '测试路 1 号，电话：1234' },
      company: false,
    })
    expect(parseInvoiceDetails('')).toEqual({ fields: {}, company: false })
  })

  test('does not truncate an overlong parsed title so form validation rejects it', () => {
    const title = 'A'.repeat(201)
    const parsed = parseInvoiceDetails(`发票抬头：${title}`)
    expect(parsed.fields.title).toBe(title)
    expect(
      invoiceApplicationSchema(i18next.t).safeParse({
        ...validApplication,
        ...parsed.fields,
      }).success
    ).toBe(false)
  })
})

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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter } from 'axios'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { Invoices } from '..'
import { downloadInvoice } from '../api'
import { ApplicationDialog } from '../components/application-dialog'
import { DetailDialog } from '../components/detail-dialog'
import { IssueDialog } from '../components/issue-dialog'
import { OrderPicker } from '../components/order-picker'
import { ReviewDialog } from '../components/review-dialog'
import type { Invoice, InvoiceOrder } from '../types'

const originalAdapter = api.defaults.adapter
const originalAuth = useAuthStore.getState().auth
const order: InvoiceOrder = {
  top_up_id: 11,
  trade_no: 'ORDER-11',
  amount_minor: 12345,
  currency: 'CNY',
  paid_at: 1780000000,
  payment_provider: 'epay',
  payment_method: 'alipay',
}
const invoice: Invoice = {
  id: 7,
  user_id: 1,
  title: 'Buyer',
  email: 'buyer@example.com',
  invoice_type: 'ordinary',
  title_type: 'personal',
  tax_id: '',
  address: '',
  phone: '',
  bank_name: '',
  bank_account: '',
  remark: '',
  amount_minor: 12345,
  currency: 'CNY',
  status: 'pending',
  rejection_reason: '',
  reviewed_by: 0,
  reviewed_at: 0,
  issued_by: 0,
  issued_at: 0,
  created_at: 1780000000,
  updated_at: 1780000000,
  invoice_number: '',
  file_name: '',
  file_size: 0,
  orders: [order],
}
let client: QueryClient
let adapter: ReturnType<typeof vi.fn<AxiosAdapter>>

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  useAuthStore.setState({
    auth: { ...originalAuth, accessToken: 'test-invoice-token' },
  })
  adapter = vi.fn(async (config) => ({
    data: {
      success: true,
      data: { page: 1, page_size: 10, total: 1, items: [order] },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  api.defaults.adapter = adapter
})
afterEach(() => {
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.setState({ auth: originalAuth })
  vi.unstubAllGlobals()
  localStorage.removeItem('status')
})

function renderWithQuery(children: ReactNode) {
  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

test('opening an application focuses the top guidance before orders load and preserves keyboard navigation and dismissal', async () => {
  const user = userEvent.setup()
  const close = vi.fn()
  let releaseOrders: () => void = () => undefined
  const ordersReady = new Promise<void>((resolve) => {
    releaseOrders = resolve
  })
  const respond = adapter.getMockImplementation()
  if (!respond) throw new Error('Missing invoice API fixture')
  adapter.mockImplementation(async (config) => {
    if (config.url === '/api/invoice/eligible') await ordersReady
    return respond(config)
  })
  renderWithQuery(<ApplicationDialog minAmountMinor={0} onClose={close} />)
  try {
    const note = screen.getByRole('note')
    await waitFor(() => expect(note).toHaveFocus())
    expect(
      screen.getByRole('textbox', { name: 'Quick fill invoice details' })
    ).not.toHaveFocus()
    releaseOrders()
    const orderCheckbox = await screen.findByRole('checkbox', {
      name: 'Select order ORDER-11',
    })
    await user.tab()
    expect(orderCheckbox).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(close).toHaveBeenCalledOnce()
  } finally {
    releaseOrders()
  }
})

test('application starts disabled and submits the selected paid order with entered invoice details', async () => {
  const user = userEvent.setup()
  const close = vi.fn()
  renderWithQuery(<ApplicationDialog minAmountMinor={0} onClose={close} />)
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
  await user.click(
    await screen.findByRole('checkbox', { name: 'Select order ORDER-11' })
  )
  await user.type(
    screen.getByRole('textbox', { name: /Invoice title/ }),
    'Buyer'
  )
  await user.type(
    screen.getByRole('textbox', { name: /Contact email/ }),
    'buyer@example.com'
  )
  await user.click(screen.getByRole('button', { name: 'Submit application' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  const request = adapter.mock.calls
    .map(([config]) => config)
    .find((config) => config.method === 'post')
  expect(request?.url).toBe('/api/invoice/self')
  expect(JSON.parse(request?.data as string)).toMatchObject({
    top_up_ids: [11],
    title: 'Buyer',
    email: 'buyer@example.com',
    title_type: 'personal',
    invoice_type: 'ordinary',
    tax_id: '',
  })
  expect(request?.headers.get('Authorization')).toBe(
    'Bearer test-invoice-token'
  )
})

test('the default minimum is 500 CNY and a smaller selected total cannot be submitted', async () => {
  const user = userEvent.setup()
  renderWithQuery(<ApplicationDialog onClose={vi.fn()} />)
  expect(screen.getByText('500 CNY')).toBeVisible()
  await user.click(
    await screen.findByRole('checkbox', { name: 'Select order ORDER-11' })
  )
  expect(
    screen.getByText('The selected total is below the minimum invoice amount.')
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
  await user.type(
    screen.getByRole('textbox', { name: /Invoice title/ }),
    'Buyer'
  )
  await user.type(
    screen.getByRole('textbox', { name: /Contact email/ }),
    'buyer@example.com'
  )
  await user.keyboard('{Enter}')
  expect(adapter.mock.calls.some(([config]) => config.method === 'post')).toBe(
    false
  )
})

test('the current threshold accepts the exact boundary and zero still requires selecting an order', async () => {
  const user = userEvent.setup()
  const view = renderWithQuery(
    <ApplicationDialog minAmountMinor={12346} onClose={vi.fn()} />
  )
  await user.click(
    await screen.findByRole('checkbox', { name: 'Select order ORDER-11' })
  )
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
  view.rerender(
    <QueryClientProvider client={client}>
      <ApplicationDialog minAmountMinor={12345} onClose={vi.fn()} />
    </QueryClientProvider>
  )
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeEnabled()
  expect(
    screen.queryByText(
      'The selected total is below the minimum invoice amount.'
    )
  ).not.toBeInTheDocument()
  view.rerender(
    <QueryClientProvider client={client}>
      <ApplicationDialog minAmountMinor={0} onClose={vi.fn()} />
    </QueryClientProvider>
  )
  expect(screen.getByText('No minimum invoice amount')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeEnabled()
  await user.click(
    screen.getByRole('checkbox', { name: 'Select order ORDER-11' })
  )
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
})

test('multiple selected recharge orders can meet the minimum together and submit as one application', async () => {
  const user = userEvent.setup()
  adapter.mockImplementation(async (config) => ({
    data: {
      success: true,
      data: {
        total: 2,
        items: [
          { ...order, amount_minor: 30000 },
          {
            ...order,
            top_up_id: 12,
            trade_no: 'ORDER-12',
            amount_minor: 20000,
          },
        ],
      },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  const close = vi.fn()
  renderWithQuery(<ApplicationDialog onClose={close} />)
  await user.click(
    await screen.findByRole('checkbox', { name: 'Select order ORDER-11' })
  )
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
  await user.click(
    screen.getByRole('checkbox', { name: 'Select order ORDER-12' })
  )
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeEnabled()
  await user.type(
    screen.getByRole('textbox', { name: /Invoice title/ }),
    'Buyer'
  )
  await user.type(
    screen.getByRole('textbox', { name: /Contact email/ }),
    'buyer@example.com'
  )
  await user.click(screen.getByRole('button', { name: 'Submit application' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  const request = adapter.mock.calls
    .map(([config]) => config)
    .find((config) => config.method === 'post')
  expect(JSON.parse(request?.data as string).top_up_ids).toEqual([11, 12])
})

test('a minimum changed on the server refreshes the displayed threshold and blocks retrying an insufficient selection', async () => {
  const user = userEvent.setup()
  let minimum = 50000
  client.setQueryData(['status'], {
    invoice_enabled: true,
    invoice_min_amount_minor: minimum,
  })
  adapter.mockImplementation(async (config) => {
    if (config.method === 'post') {
      minimum = 60000
      throw new AxiosError('Minimum changed', undefined, config, undefined, {
        data: {
          success: false,
          code: 'INVOICE_BELOW_MINIMUM',
          message: 'Minimum changed',
        },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config,
      })
    }
    let data: object = { total: 0, items: [] }
    if (config.url === '/api/status') {
      data = { invoice_enabled: true, invoice_min_amount_minor: minimum }
    }
    if (config.url === '/api/invoice/eligible') {
      data = { total: 1, items: [{ ...order, amount_minor: 50000 }] }
    }
    return {
      data: { success: true, data },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  })
  renderWithQuery(<Invoices />)
  await user.click(screen.getByRole('button', { name: 'Apply for an invoice' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Select order ORDER-11' })
  )
  await user.type(
    screen.getByRole('textbox', { name: /Invoice title/ }),
    'Buyer'
  )
  await user.type(
    screen.getByRole('textbox', { name: /Contact email/ }),
    'buyer@example.com'
  )
  await user.click(screen.getByRole('button', { name: 'Submit application' }))
  await waitFor(() => expect(screen.getAllByText('600 CNY')).toHaveLength(2))
  expect(
    screen.getByText('The selected total is below the minimum invoice amount.')
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
  expect(screen.getByRole('textbox', { name: /Invoice title/ })).toHaveValue(
    'Buyer'
  )
})

test('quick fill requires an explicit click, fills company fields and preserves unrelated entries for review', async () => {
  const user = userEvent.setup()
  renderWithQuery(<ApplicationDialog minAmountMinor={0} onClose={vi.fn()} />)
  const source = screen.getByRole('textbox', {
    name: 'Quick fill invoice details',
  })
  const recognize = screen.getByRole('button', { name: 'Recognize and fill' })
  expect(recognize).toBeDisabled()
  await user.type(
    screen.getByRole('textbox', { name: /Contact email/ }),
    'existing@example.com'
  )
  await user.click(source)
  await user.paste(`单位名称：示例科技有限公司
纳税人识别号：91330000MA12345678
开户银行：示例银行
账号：0012345678901234567890
联系电话：0571-12345678`)
  expect(screen.getByRole('textbox', { name: /Invoice title/ })).toHaveValue('')
  await user.click(recognize)
  expect(screen.getByRole('combobox', { name: 'Title type' })).toHaveValue(
    'company'
  )
  expect(screen.getByRole('textbox', { name: /Invoice title/ })).toHaveValue(
    '示例科技有限公司'
  )
  expect(screen.getByRole('textbox', { name: /Taxpayer ID/ })).toHaveValue(
    '91330000MA12345678'
  )
  expect(screen.getByRole('textbox', { name: 'Bank name' })).toHaveValue(
    '示例银行'
  )
  expect(screen.getByRole('textbox', { name: 'Bank account' })).toHaveValue(
    '0012345678901234567890'
  )
  expect(screen.getByRole('textbox', { name: 'Contact phone' })).toHaveValue(
    '0571-12345678'
  )
  expect(screen.getByRole('textbox', { name: /Contact email/ })).toHaveValue(
    'existing@example.com'
  )
  expect(
    screen.getByText(
      'Details filled in. Check the fields below before submitting.'
    )
  ).toBeVisible()
  await user.type(
    screen.getByRole('textbox', { name: /Invoice title/ }),
    '分公司'
  )
  expect(screen.getByRole('textbox', { name: /Invoice title/ })).toHaveValue(
    '示例科技有限公司分公司'
  )
  expect(
    adapter.mock.calls.filter(([config]) => config.method === 'post')
  ).toHaveLength(0)
})

test('unrecognized quick fill leaves existing details intact and displays an accessible hint', async () => {
  const user = userEvent.setup()
  renderWithQuery(<ApplicationDialog minAmountMinor={0} onClose={vi.fn()} />)
  const source = screen.getByRole('textbox', {
    name: 'Quick fill invoice details',
  })
  await user.type(
    screen.getByRole('textbox', { name: /Invoice title/ }),
    'Existing Buyer'
  )
  await user.click(source)
  await user.paste('This text has no invoice labels')
  await user.click(screen.getByRole('button', { name: 'Recognize and fill' }))
  expect(
    screen.getByText(
      'No invoice fields recognized. Use one label and value per line, separated by a colon.'
    )
  ).toBeVisible()
  expect(source).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('textbox', { name: /Invoice title/ })).toHaveValue(
    'Existing Buyer'
  )
  await user.clear(source)
  expect(source).toHaveAttribute('aria-invalid', 'false')
  expect(
    screen.getByRole('button', { name: 'Recognize and fill' })
  ).toBeDisabled()
})

test('switching invoice title types only offers ordinary invoices and clears the personal taxpayer ID', async () => {
  const user = userEvent.setup()
  renderWithQuery(<ApplicationDialog minAmountMinor={0} onClose={vi.fn()} />)
  const invoiceType = screen.getByRole('combobox', { name: 'Invoice type' })
  expect(invoiceType).toHaveValue('ordinary')
  expect(within(invoiceType).getAllByRole('option')).toHaveLength(1)
  expect(
    within(invoiceType).getByRole('option', { name: 'Ordinary VAT invoice' })
  ).toBeVisible()
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Title type' }),
    'company'
  )
  await user.type(
    screen.getByRole('textbox', { name: /Taxpayer ID/ }),
    '91310000MA12345678'
  )
  expect(invoiceType).toHaveValue('ordinary')
  expect(
    within(invoiceType).queryByRole('option', { name: 'Special VAT invoice' })
  ).not.toBeInTheDocument()
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Title type' }),
    'personal'
  )
  expect(screen.getByRole('combobox', { name: 'Invoice type' })).toHaveValue(
    'ordinary'
  )
  expect(
    screen.queryByRole('textbox', { name: /Taxpayer ID/ })
  ).not.toBeInTheDocument()
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Title type' }),
    'company'
  )
  expect(screen.getByRole('textbox', { name: /Taxpayer ID/ })).toHaveValue('')
  expect(invoiceType).toHaveValue('ordinary')
  expect(within(invoiceType).getAllByRole('option')).toHaveLength(1)
})

test('an application submission disables edits and repeated submission until the server completes', async () => {
  const user = userEvent.setup()
  let finishRequest: () => void = () => undefined
  const pending = new Promise<void>((resolve) => {
    finishRequest = resolve
  })
  adapter.mockImplementation(async (config) => {
    if (config.method === 'post') await pending
    return {
      data: { success: true, data: { total: 1, items: [order] } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  })
  const close = vi.fn()
  renderWithQuery(<ApplicationDialog minAmountMinor={0} onClose={close} />)
  await user.click(
    await screen.findByRole('checkbox', { name: 'Select order ORDER-11' })
  )
  await user.type(
    screen.getByRole('textbox', { name: /Invoice title/ }),
    'Buyer'
  )
  await user.type(
    screen.getByRole('textbox', { name: /Contact email/ }),
    'buyer@example.com'
  )
  await user.type(
    screen.getByRole('textbox', { name: 'Quick fill invoice details' }),
    'Invoice title: Buyer'
  )
  await user.click(screen.getByRole('button', { name: 'Submit application' }))
  expect(
    await screen.findByRole('button', { name: 'Submitting...' })
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('textbox', { name: /Invoice title/ })).toBeDisabled()
  expect(
    screen.getByRole('textbox', { name: 'Quick fill invoice details' })
  ).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Recognize and fill' })
  ).toBeDisabled()
  expect(
    screen.getByRole('checkbox', { name: 'Select order ORDER-11' })
  ).toHaveAttribute('aria-disabled', 'true')
  await user.click(
    screen.getByRole('checkbox', { name: 'Select order ORDER-11' })
  )
  expect(
    screen.getByRole('checkbox', { name: 'Select order ORDER-11' })
  ).toBeChecked()
  finishRequest()
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(
    adapter.mock.calls.filter(([config]) => config.method === 'post')
  ).toHaveLength(1)
})

function Picker() {
  const [selected, setSelected] = useState<InvoiceOrder[]>([])
  return (
    <OrderPicker selected={selected} onChange={setSelected} disabled={false} />
  )
}

test('order selection persists across pages and can be cleared', async () => {
  const user = userEvent.setup()
  adapter.mockImplementation(async (config) => ({
    data: {
      success: true,
      data: {
        total: 11,
        items:
          config.params.p === 1
            ? [order]
            : [{ ...order, top_up_id: 12, trade_no: 'ORDER-12' }],
      },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  renderWithQuery(<Picker />)
  const firstOrder = await screen.findByRole('checkbox', {
    name: 'Select order ORDER-11',
  })
  firstOrder.focus()
  await user.keyboard('[Space]')
  await user.click(screen.getByRole('button', { name: 'Go to next page' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Select order ORDER-12' })
  )
  expect(screen.getByText(/Selected 2 orders/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Go to previous page' }))
  expect(
    await screen.findByRole('checkbox', { name: 'Select order ORDER-11' })
  ).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Clear selection' }))
  expect(
    screen.getByRole('checkbox', { name: 'Select order ORDER-11' })
  ).not.toBeChecked()
})

test('an empty eligible order list keeps application submission disabled', async () => {
  adapter.mockImplementation(async (config) => ({
    data: { success: true, data: { total: 0, items: [] } },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  renderWithQuery(<ApplicationDialog minAmountMinor={0} onClose={vi.fn()} />)
  expect(await screen.findByText('No eligible recharge orders')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
})

test('a rejected application requires a reason and sends it to the review endpoint', async () => {
  const user = userEvent.setup()
  const close = vi.fn()
  renderWithQuery(<ReviewDialog id={7} approve={false} onClose={close} />)
  await user.click(screen.getByRole('button', { name: 'Reject' }))
  expect(
    await screen.findByText('A rejection reason is required')
  ).toBeVisible()
  expect(adapter).not.toHaveBeenCalled()
  await user.type(
    screen.getByRole('textbox', { name: 'Rejection reason' }),
    'Please correct the title'
  )
  await user.click(screen.getByRole('button', { name: 'Reject' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(adapter.mock.calls[0][0].url).toBe('/api/invoice/admin/7/review')
  expect(JSON.parse(adapter.mock.calls[0][0].data as string)).toEqual({
    approve: false,
    reason: 'Please correct the title',
  })
})

test('failed approval keeps its confirmation open so the administrator can retry', async () => {
  const user = userEvent.setup()
  const close = vi.fn()
  adapter.mockImplementation(async (config) => ({
    data: { success: false, message: 'Already reviewed' },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  renderWithQuery(<ReviewDialog id={7} approve onClose={close} />)
  await user.click(screen.getByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(adapter).toHaveBeenCalledOnce())
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled()
  )
  expect(close).not.toHaveBeenCalled()
  expect(screen.getByRole('alertdialog')).toBeVisible()
})

test('upload requires a PDF and sends an authenticated multipart request with the invoice number', async () => {
  const user = userEvent.setup()
  const close = vi.fn()
  renderWithQuery(<IssueDialog id={7} onClose={close} />)
  await user.type(
    screen.getByRole('textbox', { name: 'Invoice number' }),
    'INV-7'
  )
  await user.click(screen.getByRole('button', { name: 'Upload invoice' }))
  expect(await screen.findByText('Select an invoice PDF')).toBeVisible()
  expect(adapter).not.toHaveBeenCalled()
  const file = new File(['%PDF-1.7'], 'invoice.pdf', {
    type: 'application/pdf',
  })
  await user.upload(screen.getByLabelText('Invoice PDF'), file)
  await user.click(screen.getByRole('button', { name: 'Upload invoice' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  const config = adapter.mock.calls[0][0]
  expect(config.url).toBe('/api/invoice/admin/7/issue')
  expect(config.headers.get('Authorization')).toBe('Bearer test-invoice-token')
  expect(config.data).toBeInstanceOf(FormData)
  expect((config.data as FormData).get('invoice_number')).toBe('INV-7')
  expect((config.data as FormData).get('file')).toBe(file)
})

test('user details omit admin controls and display issued invoice download', async () => {
  adapter.mockImplementation(async (config) => ({
    data: {
      success: true,
      data: { ...invoice, status: 'issued', invoice_number: 'INV-7' },
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  renderWithQuery(<DetailDialog id={7} admin={false} onClose={vi.fn()} />)
  expect(
    await screen.findByRole('button', { name: 'Download invoice' })
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Approve' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Reject' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Upload issued invoice' })
  ).not.toBeInTheDocument()
})

test.each([
  ['pending', ['Approve', 'Reject']],
  ['approved', ['Reject', 'Upload issued invoice']],
  ['rejected', []],
  ['issued', ['Download invoice']],
])(
  'admin details in %s status show only valid workflow actions',
  async (status, actions) => {
    adapter.mockImplementation(async (config) => ({
      data: { success: true, data: { ...invoice, status } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }))
    renderWithQuery(<DetailDialog id={7} admin onClose={vi.fn()} />)
    await screen.findByText('Buyer')
    for (const action of [
      'Approve',
      'Reject',
      'Upload issued invoice',
      'Download invoice',
    ]) {
      const button = screen.queryByRole('button', { name: action })
      if (actions.includes(action)) expect(button).toBeVisible()
      else expect(button).not.toBeInTheDocument()
    }
  }
)

test('PDF download uses dashboard authentication and a generated local filename', async () => {
  const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
  adapter.mockImplementation(async (config) => ({
    data: blob,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  const createObjectURL = vi.fn(() => 'blob:invoice')
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    })
  )
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined)
  await downloadInvoice(false, 7)
  expect(adapter.mock.calls[0][0].url).toBe('/api/invoice/self/7/file')
  expect(adapter.mock.calls[0][0].headers.get('Authorization')).toBe(
    'Bearer test-invoice-token'
  )
  expect(adapter.mock.calls[0][0].responseType).toBe('blob')
  expect(createObjectURL).toHaveBeenCalledWith(blob)
  expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe(
    'invoice-7.pdf'
  )
})

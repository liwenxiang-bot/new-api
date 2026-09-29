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
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter } from 'axios'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { InvoiceSettingsSection } from '@/features/system-settings/billing/invoice-settings-section'
import { SettingsPageProvider } from '@/features/system-settings/components/settings-page-context'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { Invoices } from '..'

const originalAdapter = api.defaults.adapter
const originalAuth = useAuthStore.getState().auth
let client: QueryClient
let adapter: ReturnType<typeof vi.fn<AxiosAdapter>>
let enabled: boolean
let minAmountMinor: number

beforeEach(() => {
  enabled = true
  minAmountMinor = 0
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(['status'], {
    invoice_enabled: enabled,
    invoice_min_amount_minor: minAmountMinor,
  })
  useAuthStore.setState({
    auth: { ...originalAuth, accessToken: 'test-token' },
  })
  adapter = vi.fn(async (config) => {
    let data: object = { success: true, data: { total: 0, items: [] } }
    if (config.url === '/api/option/') {
      const option = JSON.parse(config.data as string)
      if (option.key === 'invoice_setting.enabled') {
        enabled = option.value === 'true'
      }
      if (option.key === 'invoice_setting.min_amount_minor') {
        minAmountMinor = Number(option.value)
      }
      data = { success: true }
    }
    if (config.url === '/api/status') {
      data = {
        success: true,
        data: {
          invoice_enabled: enabled,
          invoice_min_amount_minor: minAmountMinor,
        },
      }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  })
  api.defaults.adapter = adapter
})

afterEach(() => {
  client.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.setState({ auth: originalAuth })
  localStorage.removeItem('status')
})

function renderWithQuery(children: ReactNode) {
  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

function InvoiceSettingsFixture() {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <InvoiceSettingsSection
          defaultValues={{ enabled: true, minAmountMinor: 50000 }}
        />
      </SettingsPageProvider>
      <Invoices />
    </>
  )
}

test.each([false, undefined])(
  'invoice availability %s disables applications while history remains readable',
  async (availability) => {
    client.setQueryData(['status'], { invoice_enabled: availability })
    renderWithQuery(<Invoices />)
    expect(
      screen.getByRole('button', { name: 'Apply for an invoice' })
    ).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Invoice applications are currently unavailable'
    )
    expect(await screen.findByText('No invoice applications')).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Invoice application guide' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Invoice applications' })
    ).toBeVisible()
    expect(
      adapter.mock.calls.some(([config]) => config.url === '/api/invoice/self')
    ).toBe(true)
    expect(
      adapter.mock.calls.some(
        ([config]) => config.url === '/api/invoice/eligible'
      )
    ).toBe(false)
  }
)

test('the current minimum updates in the guide while the guide and history retain natural page scrolling', async () => {
  client.setQueryData(['status'], { invoice_enabled: true })
  renderWithQuery(<Invoices />)
  const guide = screen.getByRole('region', {
    name: 'Invoice application guide',
  })
  expect(within(guide).getByText('500 CNY')).toBeVisible()
  const history = screen.getByRole('region', { name: 'Invoice applications' })
  expect(
    await within(history).findByText('No invoice applications')
  ).toBeVisible()
  const scrollingPage = guide.closest('.overflow-auto')
  expect(scrollingPage).not.toBeNull()
  expect(history.closest('.overflow-auto')).toBe(scrollingPage)
  expect(history).not.toHaveClass('flex-1')
  expect(
    within(history).getByRole('button', { name: 'Go to next page' })
  ).toBeVisible()

  act(() =>
    client.setQueryData(['status'], {
      invoice_enabled: true,
      invoice_min_amount_minor: 60001,
    })
  )
  expect(await within(guide).findByText('600.01 CNY')).toBeVisible()
  expect(within(guide).queryByText('500 CNY')).not.toBeInTheDocument()
  act(() =>
    client.setQueryData(['status'], {
      invoice_enabled: true,
      invoice_min_amount_minor: 0,
    })
  )
  expect(
    await within(guide).findByText('No minimum invoice amount')
  ).toBeVisible()
  expect(
    within(guide).queryByText('Minimum invoice amount')
  ).not.toBeInTheDocument()
  expect(within(guide).queryByText('600.01 CNY')).not.toBeInTheDocument()
  expect(within(history).getByText('No invoice applications')).toBeVisible()
})

test('saving the invoice switch refreshes availability and disables new applications', async () => {
  const user = userEvent.setup()
  renderWithQuery(<InvoiceSettingsFixture />)
  expect(
    screen.getByRole('button', { name: 'Apply for an invoice' })
  ).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  const toggle = screen.getByRole('switch', {
    name: 'Enable invoice applications',
  })
  toggle.focus()
  await user.keyboard('[Space]')
  expect(toggle).not.toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Apply for an invoice' })
    ).toBeDisabled()
  )
  const request = adapter.mock.calls.find(
    ([config]) => config.url === '/api/option/'
  )?.[0]
  expect(JSON.parse(request?.data as string)).toEqual({
    key: 'invoice_setting.enabled',
    value: 'false',
  })
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
})

test.each([
  ['0', '0'],
  ['499.99', '49999'],
  ['500.01', '50001'],
  ['10000000000', '1000000000000'],
])('saving a %s CNY minimum sends exactly %s fen', async (amount, minor) => {
  const user = userEvent.setup()
  renderWithQuery(<InvoiceSettingsFixture />)
  const input = screen.getByRole('spinbutton', {
    name: 'Minimum invoice amount (CNY)',
  })
  expect(input).toHaveValue(500)
  await user.clear(input)
  await user.type(input, amount)
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() => {
    expect(client.getQueryData(['status'])).toMatchObject({
      invoice_enabled: true,
      invoice_min_amount_minor: Number(minor),
    })
  })
  const updates = adapter.mock.calls.filter(
    ([config]) => config.url === '/api/option/'
  )
  expect(updates).toHaveLength(1)
  expect(JSON.parse(updates[0][0].data as string)).toEqual({
    key: 'invoice_setting.min_amount_minor',
    value: minor,
  })
})

test.each(['', '-1', '500.001', '10000000000.01'])(
  'an invalid minimum %s shows a field error and does not save',
  async (amount) => {
    const user = userEvent.setup()
    renderWithQuery(<InvoiceSettingsFixture />)
    const input = screen.getByRole('spinbutton', {
      name: 'Minimum invoice amount (CNY)',
    })
    await user.clear(input)
    if (amount) await user.type(input, amount)
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'))
    expect(
      screen.getByText(
        'Enter an amount from 0 to 10000000000 with up to 2 decimal places.'
      )
    ).toBeVisible()
    expect(
      adapter.mock.calls.some(([config]) => config.url === '/api/option/')
    ).toBe(false)
  }
)

test('disabling invoice applications while the form is open prevents editing and retains entered details', async () => {
  const user = userEvent.setup()
  renderWithQuery(<Invoices />)
  await user.click(screen.getByRole('button', { name: 'Apply for an invoice' }))
  const title = screen.getByRole('textbox', { name: /Invoice title/ })
  await user.type(title, 'Existing draft')
  act(() => client.setQueryData(['status'], { invoice_enabled: false }))
  await waitFor(() => expect(title).toBeDisabled())
  expect(title).toHaveValue('Existing draft')
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('disabled invoice applications leave administrator invoice management available', async () => {
  client.setQueryData(['status'], { invoice_enabled: false })
  renderWithQuery(<Invoices admin />)
  expect(
    screen.getByRole('heading', { name: 'Invoice management' })
  ).toBeVisible()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(await screen.findByText('No invoice applications')).toBeVisible()
  expect(
    screen.queryByRole('region', { name: 'Invoice application guide' })
  ).not.toBeInTheDocument()
  act(() => client.setQueryData(['status'], { invoice_enabled: true }))
  expect(
    screen.queryByRole('region', { name: 'Invoice application guide' })
  ).not.toBeInTheDocument()
  expect(
    adapter.mock.calls.some(([config]) => config.url === '/api/invoice/admin')
  ).toBe(true)
})

test('a server rejection after applications are disabled refreshes status and preserves the draft', async () => {
  const user = userEvent.setup()
  adapter.mockImplementation(async (config) => {
    if (config.method === 'post') {
      enabled = false
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        {
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          config,
          data: {
            success: false,
            code: 'INVOICE_DISABLED',
            message: 'Invoice applications are disabled',
          },
        }
      )
    }
    const data =
      config.url === '/api/status'
        ? { invoice_enabled: enabled }
        : {
            total: 1,
            items: [
              {
                top_up_id: 11,
                trade_no: 'ORDER-11',
                amount_minor: 1000,
                currency: 'CNY',
                paid_at: 1780000000,
                payment_provider: 'epay',
                payment_method: 'alipay',
              },
            ],
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
    'Draft buyer'
  )
  await user.type(
    screen.getByRole('textbox', { name: /Contact email/ }),
    'buyer@example.com'
  )
  await user.click(screen.getByRole('button', { name: 'Submit application' }))
  await waitFor(() =>
    expect(
      screen.getByRole('textbox', { name: /Invoice title/ })
    ).toBeDisabled()
  )
  expect(screen.getByRole('textbox', { name: /Invoice title/ })).toHaveValue(
    'Draft buyer'
  )
  expect(
    screen.getByRole('button', { name: 'Submit application' })
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
})

test('an eligible-order rejection refreshes stale availability before any application is submitted', async () => {
  const user = userEvent.setup()
  adapter.mockImplementation(async (config) => {
    if (config.url === '/api/invoice/eligible') {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        {
          status: 403,
          statusText: 'Forbidden',
          headers: {},
          config,
          data: { success: false, code: 'INVOICE_DISABLED' },
        }
      )
    }
    const data =
      config.url === '/api/status'
        ? { invoice_enabled: false }
        : { total: 0, items: [] }
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
  await waitFor(() =>
    expect(
      screen.getByRole('textbox', { name: /Invoice title/ })
    ).toBeDisabled()
  )
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'Invoice applications are currently unavailable'
  )
  expect(adapter.mock.calls.some(([config]) => config.method === 'post')).toBe(
    false
  )
  expect(
    adapter.mock.calls.filter(([config]) => config.url === '/api/status')
  ).toHaveLength(1)
})

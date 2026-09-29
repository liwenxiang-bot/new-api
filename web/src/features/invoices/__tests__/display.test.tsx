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
import { act, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, expect, test } from 'vitest'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { InvoiceApplicationGuide } from '../components/application-guide'
import { InvoiceAmount } from '../components/invoice-display'

const originalConfig = useSystemConfigStore.getState().config

afterEach(async () => {
  useSystemConfigStore.setState({ config: originalConfig })
  await i18next.changeLanguage('en')
})

test('the responsive invoice guide explains eligibility, paid amounts, ordinary invoice titles and PDF delivery', () => {
  render(<InvoiceApplicationGuide minAmountMinor={50000} />)
  const guide = screen.getByRole('region', {
    name: 'Invoice application guide',
  })
  const terms = within(guide).getAllByRole('term')
  expect(terms.map((term) => term.textContent)).toEqual([
    'Eligible recharge orders only',
    'Invoice amount',
    'Invoice types and details',
    'Review and download',
  ])
  expect(terms[0].closest('dl')).toHaveClass('grid', 'md:grid-cols-2')
  for (const fact of [
    'Only the eligible recharge orders listed in the application can be invoiced. Rewards, redemption codes and subscription purchases are excluded.',
    'The invoice amount is based on the actual payment for the selected orders.',
    'Only ordinary VAT invoices are currently supported, with personal or company titles. Company titles require a taxpayer ID.',
    'After submission, an administrator will review your application. Once issued, download the PDF from the application details.',
  ]) {
    expect(within(guide).getByText(fact)).toBeVisible()
  }
  expect(within(guide).getByRole('note')).toHaveTextContent(
    'Check your invoice title, taxpayer ID and contact email before submitting.'
  )
})

test.each([
  ['zhCN', '123.45 CNY'],
  ['zhTW', '123.45 CNY'],
  ['en', '123.45 CNY'],
  ['fr', '123,45 CNY'],
  ['ja', '123.45 CNY'],
  ['ru', '123,45 CNY'],
  ['vi', '123,45 CNY'],
])(
  'invoice amounts render safely in %s without changing their payment currency',
  async (language, expected) => {
    await i18next.changeLanguage(language)
    const view = render(<InvoiceAmount minor={12345} currency='CNY' />)
    expect(view.container.textContent).toBe(expected)
  }
)

test('switching language updates decimal formatting and an invalid language falls back safely', async () => {
  const view = render(<InvoiceAmount minor={12345} currency='CNY' />)
  expect(view.container.textContent).toBe('123.45 CNY')
  await act(() => i18next.changeLanguage('fr'))
  expect(view.container.textContent).toBe('123,45 CNY')
  await act(() => i18next.changeLanguage('invalid_locale!'))
  expect(view.container.textContent).toBe('123.45 CNY')
})

test.each(['USD', 'CNY', 'CUSTOM', 'TOKENS'] as const)(
  'display mode %s does not convert or relabel the invoice amount',
  (quotaDisplayType) => {
    useSystemConfigStore.setState({
      config: {
        ...originalConfig,
        currency: {
          ...originalConfig.currency,
          quotaDisplayType,
          usdExchangeRate: 7,
          customCurrencyExchangeRate: 3,
          customCurrencySymbol: '€',
        },
      },
    })
    const view = render(<InvoiceAmount minor={12345} currency='CNY' />)
    expect(view.container.textContent).toBe('123.45 CNY')
  }
)

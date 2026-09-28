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
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { NavGroup } from '@/components/layout/components/nav-group'
import { SidebarProvider } from '@/components/ui/sidebar'
import type { UserWalletData } from '@/features/wallet/types'
import { useSidebarConfig } from '@/hooks/use-sidebar-config'
import { useSidebarData } from '@/hooks/use-sidebar-data'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { Referrals } from '../index'

let userData: UserWalletData
let complianceConfirmed: boolean
let rewards: {
  id: number
  invitee_id: number
  quota: number
  created_time: number
}[]

beforeEach(() => {
  userData = {
    id: 1,
    username: 'alice',
    group: 'default',
    quota: 0,
    used_quota: 0,
    request_count: 0,
    aff_count: 1,
    aff_quota: 1000000,
    aff_history_quota: 1500000,
    affiliate_reward_enabled: true,
    affiliate_reward_ratio: 10,
    affiliate_reward_min_top_up: 10,
    affiliate_invitee_reward: 0,
  }
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  complianceConfirmed = true
  rewards = []
  useAuthStore.getState().auth.setUser({ id: 1, username: 'alice', role: 1 })
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/user/self') {
      return { data: { success: true, data: { ...userData } } }
    }
    if (url === '/api/user/aff') {
      return { data: { success: true, data: 'alice-code' } }
    }
    if (url === '/api/user/topup/info') {
      return {
        data: {
          success: true,
          data: { payment_compliance_confirmed: complianceConfirmed },
        },
      }
    }
    if (url === '/api/user/self/affiliate_rewards') {
      return {
        data: {
          success: true,
          data: { items: rewards, total: rewards.length },
        },
      }
    }
    throw new Error(`Unexpected GET ${url}`)
  })
  vi.spyOn(api, 'post').mockImplementation(async (url, body) => {
    if (url !== '/api/user/aff_transfer') {
      throw new Error(`Unexpected POST ${url}`)
    }
    userData.aff_quota -= (body as { quota: number }).quota
    userData.quota += (body as { quota: number }).quota
    return { data: { success: true } }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

function Navigation() {
  const groups = useSidebarConfig(useSidebarData().navGroups)
  const personal = groups.find((group) => group.id === 'personal')
  return (
    <SidebarProvider>
      <nav aria-label='Personal'>{personal && <NavGroup {...personal} />}</nav>
      <Outlet />
    </SidebarProvider>
  )
}

async function renderPage(path = '/referrals') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(['status'], {})
  const root = createRootRoute({ component: Navigation })
  const referrals = createRoute({
    getParentRoute: () => root,
    path: '/referrals',
    component: Referrals,
  })
  const wallet = createRoute({
    getParentRoute: () => root,
    path: '/wallet',
    component: () => <div>Wallet page</div>,
  })
  const router = createRouter({
    routeTree: root.addChildren([referrals, wallet]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return router
}

test('the personal navigation exposes the standalone rewards page and supports keyboard navigation', async () => {
  const user = userEvent.setup()
  const router = await renderPage('/wallet')
  const link = within(
    screen.getByRole('navigation', { name: 'Personal' })
  ).getByRole('link', { name: 'Referral Rewards' })
  expect(link).toHaveAttribute('href', '/referrals')
  link.focus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(router.state.location.pathname).toBe('/referrals'))
  expect(link).toHaveAttribute('aria-current', 'page')
  expect(
    await screen.findByRole('heading', { name: 'Referral Rewards', level: 2 })
  ).toBeVisible()
  expect(await screen.findByText('No referral rewards yet')).toBeVisible()
})

test('the referral link is copyable and the page explains that rewards cannot be withdrawn', async () => {
  const user = userEvent.setup()
  const writeText = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue()
  await renderPage()
  const copyButton = await screen.findByRole('button', {
    name: 'Copy referral link',
  })
  await user.click(copyButton)
  expect(writeText).toHaveBeenCalledWith(
    `${window.location.origin}/sign-up?aff=alice-code`
  )
  expect(
    screen.getByText(
      /Rewards can only be transferred to your balance. Cash withdrawal is unavailable./
    )
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /withdraw/i })
  ).not.toBeInTheDocument()
})

test('a successful transfer refreshes the available rewards and closes the existing transfer dialog', async () => {
  const user = userEvent.setup()
  await renderPage()
  await user.click(
    await screen.findByRole('button', { name: 'Transfer to Balance' })
  )
  const dialog = await screen.findByRole('dialog', { name: 'Transfer Rewards' })
  expect(
    within(dialog).getByRole('spinbutton', { name: 'Transfer Amount' })
  ).toHaveValue(1)
  await user.click(within(dialog).getByRole('button', { name: 'Transfer' }))
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/user/aff_transfer', {
      quota: 500000,
    })
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  )
  await user.click(screen.getByRole('button', { name: 'Transfer to Balance' }))
  expect(
    await screen.findByRole('dialog', { name: 'Transfer Rewards' })
  ).toHaveTextContent('$1')
})

test('a failed transfer keeps the dialog open and preserves the entered amount', async () => {
  vi.mocked(api.post).mockResolvedValue({
    data: { success: false, message: 'Transfer rejected' },
  })
  const user = userEvent.setup()
  await renderPage()
  await user.click(
    await screen.findByRole('button', { name: 'Transfer to Balance' })
  )
  const dialog = await screen.findByRole('dialog', { name: 'Transfer Rewards' })
  await user.click(within(dialog).getByRole('button', { name: 'Transfer' }))
  await waitFor(() => expect(api.post).toHaveBeenCalled())
  expect(dialog).toBeVisible()
  expect(
    within(dialog).getByRole('spinbutton', { name: 'Transfer Amount' })
  ).toHaveValue(1)
})

test('unconfirmed compliance disables transferring rewards', async () => {
  complianceConfirmed = false
  await renderPage()
  expect(
    await screen.findByRole('button', { name: 'Transfer to Balance' })
  ).toBeDisabled()
  expect(
    screen.getByText(
      'Referral reward transfer is disabled until the administrator confirms compliance terms.'
    )
  ).toBeVisible()
})

test('reward history shows the referred user ID and requests the next server page', async () => {
  const baseGet = vi.mocked(api.get).getMockImplementation()
  if (!baseGet) throw new Error('Missing API fixture')
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url !== '/api/user/self/affiliate_rewards') return baseGet(url, config)
    const secondPage = config?.params.p === 2
    return {
      data: {
        success: true,
        data: {
          items: [
            {
              id: secondPage ? 2 : 1,
              invitee_id: secondPage ? 205 : 101,
              quota: 500000,
              created_time: 1780000000,
            },
          ],
          total: 11,
        },
      },
    }
  })
  const user = userEvent.setup()
  await renderPage()
  const history = screen.getByRole('region', { name: 'Rewards History' })
  expect(
    await within(history).findByRole('cell', { name: '101' })
  ).toBeVisible()
  expect(
    within(history).getByRole('table').parentElement?.parentElement
  ).toHaveClass('overflow-x-auto')
  await user.click(
    within(history).getByRole('button', { name: 'Go to next page' })
  )
  expect(
    await within(history).findByRole('cell', { name: '205' })
  ).toBeVisible()
  expect(api.get).toHaveBeenCalledWith('/api/user/self/affiliate_rewards', {
    params: { p: 2, page_size: 10 },
  })
  expect(
    within(history).getByRole('button', { name: 'Go to next page' })
  ).toBeDisabled()
})

test('a failed summary offers retry without exposing a transfer action', async () => {
  const baseGet = vi.mocked(api.get).getMockImplementation()
  if (!baseGet) throw new Error('Missing API fixture')
  let failProfile = true
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url === '/api/user/self' && failProfile) {
      return { data: { success: false } }
    }
    return baseGet(url, config)
  })
  const user = userEvent.setup()
  await renderPage()
  expect(await screen.findByText('Oops! Something went wrong')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Transfer to Balance' })
  ).not.toBeInTheDocument()
  failProfile = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(
    await screen.findByRole('button', { name: 'Transfer to Balance' })
  ).toBeEnabled()
})

test('failed reward history offers retry independently of the summary', async () => {
  const baseGet = vi.mocked(api.get).getMockImplementation()
  if (!baseGet) throw new Error('Missing API fixture')
  let failHistory = true
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url === '/api/user/self/affiliate_rewards' && failHistory) {
      return { data: { success: false } }
    }
    return baseGet(url, config)
  })
  const user = userEvent.setup()
  await renderPage()
  const history = screen.getByRole('region', { name: 'Rewards History' })
  expect(
    await within(history).findByText('Oops! Something went wrong')
  ).toBeVisible()
  expect(
    await screen.findByRole('button', { name: 'Copy referral link' })
  ).toBeEnabled()
  failHistory = false
  await user.click(within(history).getByRole('button', { name: 'Retry' }))
  expect(
    await within(history).findByText('No referral rewards yet')
  ).toBeVisible()
})

test('while the summary is loading, rewards stay unavailable until account data arrives', async () => {
  const baseGet = vi.mocked(api.get).getMockImplementation()
  if (!baseGet) throw new Error('Missing API fixture')
  let releaseProfile: () => void = () => undefined
  const profileReady = new Promise<void>((resolve) => {
    releaseProfile = resolve
  })
  vi.mocked(api.get).mockImplementation(async (url, config) => {
    if (url === '/api/user/self') await profileReady
    return baseGet(url, config)
  })
  await renderPage()
  expect(
    await screen.findByRole('status', { name: 'Loading...' })
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Transfer to Balance' })
  ).not.toBeInTheDocument()
  releaseProfile()
  expect(
    await screen.findByRole('button', { name: 'Transfer to Balance' })
  ).toBeEnabled()
  expect(
    screen.queryByRole('status', { name: 'Loading...' })
  ).not.toBeInTheDocument()
})

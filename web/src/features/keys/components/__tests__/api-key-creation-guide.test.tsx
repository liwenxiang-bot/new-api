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
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import type { PricingData, PricingModel } from '@/features/pricing/types'
import { api } from '@/lib/api'

import { ApiKeyCreationGuideDialog } from '../dialogs/api-key-creation-guide-dialog'

function model(name: string, groups: string[]): PricingModel {
  return {
    id: 1,
    model_name: name,
    enable_groups: groups,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
  }
}

let queryClient: QueryClient
let pricing: PricingData
let groups: Record<string, { desc: string; ratio: number }>
let pricingFails: boolean
let groupsFail: boolean

async function renderGuide(onCreate = vi.fn()) {
  const root = createRootRoute({
    component: () => (
      <ApiKeyCreationGuideDialog
        open
        onOpenChange={vi.fn()}
        onCreate={onCreate}
      />
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  await screen.findByRole('dialog', { name: 'API Key Creation Guide' })
  return onCreate
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  pricingFails = false
  groupsFail = false
  pricing = {
    success: true,
    data: [
      model('claude-sonnet', ['cc-max']),
      model('claude-sonnet', ['cc-max']),
      model('codex-model', ['codex']),
      model('shared-model', ['cc-max', 'codex']),
      model('catalog-only-model', ['all']),
    ],
    vendors: [],
    group_ratio: {},
    usable_group: {},
    supported_endpoint: {},
    auto_groups: [],
  }
  groups = {
    'cc-max': { desc: 'Claude Code', ratio: 2 },
    codex: { desc: 'Codex', ratio: 0.3 },
  }
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/pricing') {
      if (pricingFails) throw new Error('Network unavailable')
      return { data: pricing }
    }
    if (url === '/api/user/self/groups') {
      if (groupsFail) return { data: { success: false } }
      return { data: { success: true, data: groups } }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.spyOn(api, 'post').mockRejectedValue(
    new Error('The guide must not create keys')
  )
})

afterEach(() => {
  cleanup()
  queryClient.clear()
})

describe('API key creation guide', () => {
  test('shows unique models for cc-max and hands off its preset without posting a key', async () => {
    const onCreate = await renderGuide()
    expect(await screen.findAllByText('claude-sonnet')).toHaveLength(1)
    expect(screen.getByText('shared-model')).toBeInTheDocument()
    expect(screen.queryByText('codex-model')).not.toBeInTheDocument()
    expect(screen.queryByText('catalog-only-model')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Model Plaza' })).toHaveAttribute(
      'href',
      '/pricing?group=cc-max'
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Create Claude Code key' })
      ).toBeEnabled()
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Create Claude Code key' })
    )
    expect(onCreate).toHaveBeenCalledWith({
      name: 'claude-code',
      group: 'cc-max',
    })
    expect(api.post).not.toHaveBeenCalled()
  })

  test('supports keyboard selection of Codex with its models and preset', async () => {
    const user = userEvent.setup()
    const onCreate = await renderGuide()
    await screen.findByText('claude-sonnet')
    screen.getByRole('tab', { name: 'Claude Code' }).focus()
    await user.keyboard('{ArrowRight}{Enter}')
    expect(screen.getByRole('tab', { name: 'Codex' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(await screen.findByText('codex-model')).toBeInTheDocument()
    expect(screen.queryByText('claude-sonnet')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create Codex key' }))
    expect(onCreate).toHaveBeenCalledWith({ name: 'codex', group: 'codex' })
  })

  test('disables creation when the selected group is unavailable', async () => {
    delete groups['cc-max']
    await renderGuide()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The cc-max group is not available for this account.'
    )
    expect(
      screen.getByRole('button', { name: 'Create Claude Code key' })
    ).toBeDisabled()
  })

  test('shows a retry action after pricing fails and loads models after retry', async () => {
    pricingFails = true
    await renderGuide()
    await screen.findByText('Failed to load models')
    expect(
      screen.queryByText('No models are currently available in this group.')
    ).not.toBeInTheDocument()
    pricingFails = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('claude-sonnet')).toBeInTheDocument()
  })

  test('keeps creation disabled after a group API failure until retry succeeds', async () => {
    groupsFail = true
    await renderGuide()
    await screen.findByText('Failed to load groups')
    expect(
      screen.getByRole('button', { name: 'Create Claude Code key' })
    ).toBeDisabled()
    groupsFail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Create Claude Code key' })
      ).toBeEnabled()
    )
  })

  test('shows an empty model list without inventing models for a valid group', async () => {
    pricing.data = []
    await renderGuide()
    expect(
      await screen.findByText(
        'No models are currently available in this group.'
      )
    ).toBeInTheDocument()
  })
})

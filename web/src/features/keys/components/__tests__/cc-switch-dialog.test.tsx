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
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { CCSwitchDialog } from '../dialogs/cc-switch-dialog'

let queryClient: QueryClient

function KeyDialog(
  props: Pick<ComponentProps<typeof CCSwitchDialog>, 'apiKey'>
) {
  return (
    <QueryClientProvider client={queryClient}>
      <CCSwitchDialog
        open
        onOpenChange={() => undefined}
        tokenKey='test-key'
        apiKey={props.apiKey}
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'test-user',
    role: 1,
    group: 'default',
  })
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  useAuthStore.getState().auth.reset('idle')
  localStorage.clear()
})

describe('CC Switch model selection', () => {
  test('only offers the key group models and exports the selected model', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockImplementation(async (_url, config) => ({
        data: {
          success: true,
          data:
            config?.params?.group === 'codex'
              ? ['codex-primary', 'codex-fast']
              : ['codex-primary', 'codex-fast', 'gemini-primary'],
        },
      }))
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const onOpenChange = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <CCSwitchDialog
          open
          onOpenChange={onOpenChange}
          tokenKey='test-key'
          apiKey={{ id: 1, group: 'codex', auto_groups: null }}
        />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Codex' }))
    fireEvent.focus(screen.getByPlaceholderText('Select or enter model name'))
    const model = await screen.findByRole('option', { name: 'codex-primary' })
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(['codex-primary', 'codex-fast'])
    expect(get).toHaveBeenCalledWith('/api/user/models', {
      params: { group: 'codex' },
    })

    fireEvent.mouseDown(model)
    fireEvent.click(screen.getByRole('button', { name: 'Open CC Switch' }))
    expect(open).toHaveBeenCalledOnce()
    const url = new URL(String(open.mock.calls[0][0]))
    expect(url.searchParams.get('app')).toBe('codex')
    expect(url.searchParams.get('model')).toBe('codex-primary')
    expect(url.searchParams.get('apiKey')).toBe('sk-test-key')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('switching keys clears the selected model and hides old options while the new group loads', async () => {
    let resolveModels!: (value: {
      data: { success: boolean; data: string[] }
    }) => void
    const pendingModels = new Promise<{
      data: { success: boolean; data: string[] }
    }>((resolve) => {
      resolveModels = resolve
    })
    vi.spyOn(api, 'get').mockImplementation(async (_url, config) => {
      if (config?.params?.group === 'gemini') return pendingModels
      return { data: { success: true, data: ['codex-primary'] } }
    })
    const view = render(
      <KeyDialog apiKey={{ id: 1, group: 'codex', auto_groups: null }} />
    )
    fireEvent.focus(screen.getByRole('combobox', { name: /Primary Model/ }))
    fireEvent.mouseDown(
      await screen.findByRole('option', { name: 'codex-primary' })
    )
    expect(screen.getByRole('button', { name: 'Open CC Switch' })).toBeEnabled()

    view.rerender(
      <KeyDialog apiKey={{ id: 2, group: 'gemini', auto_groups: null }} />
    )
    expect(screen.getByRole('combobox', { name: /Primary Model/ })).toHaveValue(
      ''
    )
    expect(
      screen.getByRole('button', { name: 'Open CC Switch' })
    ).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Loading...')
    fireEvent.focus(screen.getByRole('combobox', { name: /Primary Model/ }))
    expect(
      screen.queryByRole('option', { name: 'codex-primary' })
    ).not.toBeInTheDocument()

    resolveModels({ data: { success: true, data: ['gemini-primary'] } })
    expect(
      await screen.findByRole('option', { name: 'gemini-primary' })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'codex-primary' })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Open CC Switch' })
    ).toBeDisabled()
  })

  test.each([
    { group: '', auto_groups: null, expectedGroup: 'default' },
    { group: 'auto', auto_groups: null, expectedGroup: 'auto' },
    { group: 'auto', auto_groups: [], expectedGroup: 'auto' },
  ])(
    'uses $expectedGroup for a key with group "$group" and Auto override $auto_groups',
    async (fixture) => {
      const get = vi.spyOn(api, 'get').mockResolvedValue({
        data: { success: true, data: ['group-model'] },
      })
      render(
        <KeyDialog
          apiKey={{
            id: 1,
            group: fixture.group,
            auto_groups: fixture.auto_groups,
          }}
        />
      )
      fireEvent.focus(screen.getByRole('combobox', { name: /Primary Model/ }))
      expect(
        await screen.findByRole('option', { name: 'group-model' })
      ).toBeInTheDocument()
      expect(get).toHaveBeenCalledWith('/api/user/models', {
        params: { group: fixture.expectedGroup },
      })
    }
  )

  test('custom Auto groups only offer the union of their models without duplicates', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockImplementation(async (_url, config) => ({
        data: {
          success: true,
          data:
            config?.params?.group === 'codex'
              ? ['codex-primary', 'shared-model']
              : ['gemini-primary', 'shared-model'],
        },
      }))
    render(
      <KeyDialog
        apiKey={{ id: 1, group: 'auto', auto_groups: ['codex', 'gemini'] }}
      />
    )
    fireEvent.focus(screen.getByRole('combobox', { name: /Primary Model/ }))
    await screen.findByRole('option', { name: 'codex-primary' })
    expect(
      screen.getAllByRole('option').map((option) => option.textContent)
    ).toEqual(['codex-primary', 'shared-model', 'gemini-primary'])
    expect(get.mock.calls.map(([, config]) => config?.params?.group)).toEqual([
      'codex',
      'gemini',
    ])
  })

  test.each([
    { response: { success: true, data: [] }, status: 'No models found' },
    { response: { success: true, data: null }, status: 'No models found' },
    {
      response: { success: false, data: ['unavailable-model'] },
      status: 'Loading failed',
    },
  ])(
    'keeps export disabled with "$status" when the model response is $response',
    async ({ response, status }) => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: response })
      render(
        <KeyDialog apiKey={{ id: 1, group: 'codex', auto_groups: null }} />
      )
      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(status)
      )
      fireEvent.focus(screen.getByRole('combobox', { name: /Primary Model/ }))
      expect(screen.queryByRole('option')).not.toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Open CC Switch' })
      ).toBeDisabled()
    }
  )

  test('does not request all groups when the inherited user group is unavailable', () => {
    useAuthStore.getState().auth.setUser(null)
    const get = vi.spyOn(api, 'get')
    render(<KeyDialog apiKey={{ id: 1, group: '', auto_groups: null }} />)
    expect(screen.getByRole('status')).toHaveTextContent('No models found')
    expect(
      screen.getByRole('button', { name: 'Open CC Switch' })
    ).toBeDisabled()
    expect(get).not.toHaveBeenCalled()
  })
})

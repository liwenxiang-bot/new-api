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
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { CCSwitchDialog } from '../dialogs/cc-switch-dialog'

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  vi.spyOn(api, 'get').mockResolvedValue({
    data: {
      success: true,
      data: ['claude-example', 'gpt-example', 'gemini-example'],
    },
  })
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  localStorage.clear()
})

function renderDialog(onOpenChange = () => undefined) {
  return render(
    <QueryClientProvider client={queryClient}>
      <CCSwitchDialog open onOpenChange={onOpenChange} tokenKey='test-key' />
    </QueryClientProvider>
  )
}

describe('CC Switch unfiltered model selection', () => {
  test.each(['Claude', 'Codex', 'Gemini'])(
    'offers the full model list when %s is selected',
    async (app) => {
      renderDialog()
      fireEvent.click(screen.getByRole('radio', { name: app }))
      fireEvent.focus(
        screen.getAllByPlaceholderText('Select or enter model name')[0]
      )

      await screen.findByRole('option', { name: 'claude-example' })
      expect(
        screen.getAllByRole('option').map((option) => option.textContent)
      ).toEqual(['claude-example', 'gpt-example', 'gemini-example'])
      expect(api.get).toHaveBeenCalledWith('/api/user/models')
    }
  )

  test('exports a manually selected model with the original Codex connection settings', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const onOpenChange = vi.fn()
    localStorage.setItem(
      'status',
      JSON.stringify({ server_address: 'https://gateway.example' })
    )
    renderDialog(onOpenChange)
    fireEvent.click(screen.getByRole('radio', { name: 'Codex' }))
    fireEvent.focus(screen.getByPlaceholderText('Select or enter model name'))
    fireEvent.mouseDown(
      await screen.findByRole('option', { name: 'gpt-example' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open CC Switch' }))

    expect(open).toHaveBeenCalledOnce()
    const url = new URL(String(open.mock.calls[0][0]))
    expect(url.protocol).toBe('ccswitch:')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      app: 'codex',
      name: 'My Codex',
      model: 'gpt-example',
      endpoint: 'https://gateway.example/v1',
      apiKey: 'sk-test-key',
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('requires a primary model before opening CC Switch', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Open CC Switch' }))
    expect(open).not.toHaveBeenCalled()
  })
})

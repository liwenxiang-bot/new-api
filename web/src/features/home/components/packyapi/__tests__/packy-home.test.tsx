/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { PackyHome } from '../packy-home'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: null }),
}))

vi.mock('../Hero', () => ({ Hero: () => <div data-testid='hero' /> }))
vi.mock('../Features', () => ({
  Features: () => <div data-testid='features' />,
}))
vi.mock('../HowItWorks', () => ({
  HowItWorks: () => <div data-testid='how-it-works' />,
}))
vi.mock('../Ecosystem', () => ({
  Ecosystem: () => <div data-testid='ecosystem' />,
}))
vi.mock('../Cta', () => ({ Cta: () => <div data-testid='cta' /> }))

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('packy-snap-enabled')
})

describe('PackyHome scroll behavior', () => {
  test('scopes the full-page snap mode to the landing page lifecycle', () => {
    render(<PackyHome isAuthenticated={false} />)

    expect(document.documentElement).toHaveClass('packy-snap-enabled')
    expect(document.querySelectorAll('.packy-page')).toHaveLength(5)

    cleanup()
    expect(document.documentElement).not.toHaveClass('packy-snap-enabled')
  })
})

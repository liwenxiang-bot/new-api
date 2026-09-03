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
import { render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

import { Footer } from '../footer'

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({ status: null }),
}))

vi.mock('@/hooks/use-system-config', () => ({
  useSystemConfig: () => ({
    systemName: 'Test API',
    logo: '/logo.png',
    footerHtml: '© 2026 Test API',
    demoSiteEnabled: false,
  }),
}))

describe('footer layout', () => {
  test('centers the configured footer content and legal links as one group', () => {
    const rendered = render(<Footer />)

    const content = rendered.container.querySelector('.bg-muted\\/20')

    expect(content).toHaveClass('justify-center')
  })
})

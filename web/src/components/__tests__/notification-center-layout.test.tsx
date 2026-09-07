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
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { NotificationPopover } from '../notification-popover'

describe('NotificationPopover layout', () => {
  test('renders an enlarged modal with a full-height scrollable content area', () => {
    render(
      <NotificationPopover
        open
        onOpenChange={() => undefined}
        unreadCount={2}
        activeTab='notice'
        onTabChange={() => undefined}
        notice={'# Platform update\n\nA longer announcement body.'}
        announcements={[]}
        loading={false}
      />
    )

    const dialog = screen.getByRole('dialog', {
      name: 'System Announcements',
    })
    const scrollArea = dialog.querySelector('[data-slot="scroll-area"]')

    expect(dialog).toHaveClass(
      'h-[min(80vh,54rem)]',
      'w-[min(80vw,78rem)]',
      'max-w-none',
      'overflow-hidden'
    )
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass(
      'bg-black/45',
      'backdrop-blur-[2px]'
    )
    expect(scrollArea).toHaveClass('h-full')
    expect(
      dialog.querySelector('[data-slot="popover-content"]')
    ).not.toBeInTheDocument()
  })
})

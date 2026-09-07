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
        activeTab='announcements'
        onTabChange={() => undefined}
        notice='A platform notice.'
        announcements={[
          {
            content: '# System announcement\n\nA longer announcement body.',
            publishDate: '2026-09-07T00:00:00Z',
          },
        ]}
        loading={false}
      />
    )

    const dialog = screen.getByRole('dialog', {
      name: 'Message Center',
    })
    const tabs = screen.getAllByRole('tab')
    const scrollArea = dialog.querySelector('[data-slot="scroll-area"]')

    expect(tabs[0]).toHaveTextContent('System Announcements')
    expect(tabs[1]).toHaveTextContent('Notifications')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(dialog).toHaveClass(
      'h-[calc(100vh-2rem)]',
      'w-[calc(100vw-2rem)]',
      'max-w-none',
      'overflow-hidden'
    )
    expect(dialog).toHaveClass(
      'sm:h-[min(76vh,40rem)]',
      'sm:w-[min(62vw,58rem)]'
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

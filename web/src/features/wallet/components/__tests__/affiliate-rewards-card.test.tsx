/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'

import type { UserWalletData } from '../../types'
import { AffiliateRewardsCard } from '../affiliate-rewards-card'

function userData(overrides: Partial<UserWalletData> = {}): UserWalletData {
  return {
    id: 1,
    username: 'alice',
    quota: 100,
    used_quota: 0,
    request_count: 0,
    aff_quota: 500,
    aff_history_quota: 1200,
    aff_count: 3,
    affiliate_reward_enabled: true,
    affiliate_reward_ratio: 10,
    affiliate_reward_min_top_up: 10,
    affiliate_invitee_reward: 100,
    group: 'default',
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('affiliate rewards card', () => {
  test('shows the percentage, threshold, and balance-only policy', () => {
    render(
      <AffiliateRewardsCard
        user={userData()}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={vi.fn()}
      />
    )

    expect(screen.getByText('10%')).toBeVisible()
    expect(screen.getByText(/Minimum qualifying top-up/)).toBeVisible()
    expect(
      screen.getByText(/Rewards can only be transferred to your balance/)
    ).toBeVisible()
    expect(screen.getByText('Qualified Invites')).toBeVisible()
  })

  test('copies the invitation link and exposes the balance transfer action', async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    const onTransfer = vi.fn()

    render(
      <AffiliateRewardsCard
        user={userData()}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={onTransfer}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Copy referral link' }))
    expect(writeText).toHaveBeenCalledWith(
      'https://example.com/register?aff=alice'
    )
    expect(
      screen.getByRole('button', { name: 'Transfer to Balance' })
    ).toBeEnabled()
  })

  test('hides transfer when no rewards are available', () => {
    render(
      <AffiliateRewardsCard
        user={userData({ aff_quota: 0 })}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={vi.fn()}
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Transfer to Balance' })
    ).not.toBeInTheDocument()
  })
})

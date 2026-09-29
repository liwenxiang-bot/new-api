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
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
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
  test.each([
    ['zhCN', '12,345'],
    ['zhTW', '12,345'],
    ['en', '12,345'],
    ['fr', '12 345'],
    ['ru', '12 345'],
    ['ja', '12,345'],
    ['vi', '12.345'],
    ['invalid_locale', '12,345'],
  ])(
    'formats invitation counts when the interface switches to %s',
    async (language, count) => {
      const i18n = createInstance()
      await i18n.use(initReactI18next).init({
        lng: 'en',
        fallbackLng: 'en',
        resources: {
          en: { translation: { 'Qualified Invites': 'Qualified Invites' } },
          [language]: {
            translation: { 'Qualified Invites': 'Qualified Invites' },
          },
        },
      })
      render(
        <I18nextProvider i18n={i18n}>
          <AffiliateRewardsCard
            minimumQuota={100}
            user={userData({ affiliate_qualified_invites: 12345 })}
            affiliateLink='https://example.com/register?aff=alice'
            onTransfer={vi.fn()}
          />
        </I18nextProvider>
      )
      expect(screen.getByText('12,345')).toBeVisible()
      await act(async () => {
        await i18n.changeLanguage(language)
      })
      expect(screen.getByText(count)).toBeVisible()
    }
  )

  test('shows the percentage, threshold, and balance-only policy', () => {
    render(
      <AffiliateRewardsCard
        minimumQuota={100}
        user={userData()}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={vi.fn()}
      />
    )

    expect(screen.getByText('10%')).toBeVisible()
    expect(screen.getByText('Available Rewards')).toBeVisible()
    expect(screen.getByText(/Minimum qualifying top-up/)).toBeVisible()
    expect(
      screen.getByText(/Rewards can only be transferred to your balance/)
    ).toBeVisible()
    expect(screen.getByText('Qualified Invites')).toBeVisible()
    expect(
      screen.getByText(/Invite friends to register through your referral link/)
    ).toBeVisible()
    const rateBadge = screen
      .getByText('Current commission rate')
      .closest('[data-slot="badge"]')
    expect(rateBadge).toHaveTextContent('10%')
    expect(rateBadge).toHaveClass('max-w-full', 'flex-wrap')
    expect(screen.getByText('10%')).toHaveClass('text-base')
    expect(screen.getByText(/Minimum transfer amount/)).toBeVisible()
  })

  test('displays the latest server rate when the summary changes', () => {
    const props = {
      affiliateLink: 'https://example.com/register?aff=alice',
      minimumQuota: 100,
      onTransfer: vi.fn(),
    }
    const view = render(<AffiliateRewardsCard {...props} user={userData()} />)
    expect(screen.getByText('10%')).toBeVisible()
    view.rerender(
      <AffiliateRewardsCard
        {...props}
        user={userData({ affiliate_reward_ratio: 7.5 })}
      />
    )
    expect(screen.getByText('7.5%')).toBeVisible()
    expect(screen.queryByText('10%')).not.toBeInTheDocument()
    expect(
      screen.getByText(/rate in effect when the top-up succeeds/)
    ).toBeVisible()
  })

  test('disables transfers below the minimum and explains the threshold', () => {
    render(
      <AffiliateRewardsCard
        minimumQuota={1000}
        user={userData()}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={vi.fn()}
      />
    )
    const transfer = screen.getByRole('button', {
      name: 'Transfer to Balance',
    })
    expect(transfer).toBeDisabled()
    expect(transfer).toHaveAccessibleDescription(/Minimum transfer amount/)
    expect(screen.getAllByText(/Minimum transfer amount/)).toHaveLength(1)
    expect(
      screen.queryByText(/Available rewards must reach/)
    ).not.toBeInTheDocument()
  })

  test('disables transfers when the server marks the minimum unavailable', () => {
    render(
      <AffiliateRewardsCard
        minimumQuota={null}
        user={userData()}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={vi.fn()}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Transfer to Balance' })
    ).toBeDisabled()
    expect(
      screen.getByText('Referral reward transfer is currently unavailable.')
    ).toBeVisible()
  })

  test('copies the invitation link and exposes the balance transfer action', async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    const onTransfer = vi.fn()

    render(
      <AffiliateRewardsCard
        minimumQuota={100}
        user={userData()}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={onTransfer}
      />
    )

    const copy = screen.getByRole('button', { name: 'Copy referral link' })
    expect(copy).toHaveTextContent('Copy referral link')
    const link = screen.getByRole('textbox', { name: 'Referral link:' })
    expect(screen.getByLabelText('Referral link:')).toBe(link)
    expect(link).toHaveAttribute('readonly')
    await user.click(copy)
    expect(writeText).toHaveBeenCalledWith(
      'https://example.com/register?aff=alice'
    )
    expect(
      screen.getByRole('button', { name: 'Transfer to Balance' })
    ).toBeEnabled()
    expect(screen.getByRole('textbox', { name: 'Referral link:' })).toHaveValue(
      'https://example.com/register?aff=alice'
    )
    await user.click(
      screen.getByRole('button', { name: 'Transfer to Balance' })
    )
    expect(onTransfer).toHaveBeenCalledOnce()
  })

  test('disables transfer while payment compliance is unconfirmed', () => {
    render(
      <AffiliateRewardsCard
        minimumQuota={100}
        user={userData()}
        affiliateLink='https://example.com/register?aff=alice'
        complianceConfirmed={false}
        onTransfer={vi.fn()}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Transfer to Balance' })
    ).toBeDisabled()
  })

  test('keeps legacy invitation counts distinct from qualified top-ups', () => {
    render(
      <AffiliateRewardsCard
        minimumQuota={100}
        user={userData({ affiliate_reward_enabled: false })}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={vi.fn()}
      />
    )
    expect(screen.getByText('Invited Users')).toBeVisible()
    expect(screen.queryByText('Qualified Invites')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Current commission rate')
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Top-up referral rewards are currently disabled/)
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Transfer to Balance' })
    ).toBeEnabled()
  })

  test('hides transfer when no rewards are available', () => {
    render(
      <AffiliateRewardsCard
        minimumQuota={100}
        user={userData({ aff_quota: 0 })}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={vi.fn()}
      />
    )

    expect(
      screen.queryByRole('button', { name: 'Transfer to Balance' })
    ).not.toBeInTheDocument()
  })

  test('keeps transferring beside available rewards and stacks that metric above the other two on mobile', () => {
    render(
      <AffiliateRewardsCard
        minimumQuota={100}
        user={userData()}
        affiliateLink='https://example.com/register?aff=alice'
        onTransfer={vi.fn()}
      />
    )
    const label = screen.getByText('Available Rewards')
    const metrics = label.closest('dl')
    expect(metrics).toHaveClass('grid-cols-2', 'sm:grid-cols-3')
    expect(label.parentElement).toHaveClass('col-span-2', 'sm:col-span-1')
    const transfer = screen.getByRole('button', {
      name: 'Transfer to Balance',
    })
    const availableValue = transfer.closest('dd')
    expect(availableValue).not.toBeNull()
    expect(availableValue?.parentElement).toBe(label.parentElement)
    expect(transfer).toHaveAccessibleDescription(/Minimum transfer amount/)
  })

  test('a long referral link can shrink beside its copy button and stack above it on mobile without losing the copied value', async () => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    const referralLink =
      'https://gateway.example.com/sign-up?aff=the-complete-referral-code-must-remain-copyable-even-when-the-visible-input-is-narrow&source=member-invitation'
    render(
      <AffiliateRewardsCard
        minimumQuota={100}
        user={userData()}
        affiliateLink={referralLink}
        onTransfer={vi.fn()}
      />
    )
    const link = screen.getByRole('textbox', { name: 'Referral link:' })
    expect(link).toHaveValue(referralLink)
    expect(link).toHaveClass('min-w-0', 'flex-1')
    expect(link.parentElement).toHaveClass('flex-col', 'sm:flex-row')
    const copy = screen.getByRole('button', { name: 'Copy referral link' })
    copy.focus()
    await user.keyboard('{Enter}')
    expect(writeText).toHaveBeenCalledWith(referralLink)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible()
  })
})

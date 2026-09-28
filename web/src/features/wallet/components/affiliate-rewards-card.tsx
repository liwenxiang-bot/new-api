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
import { Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'
import { formatCurrencyFromUSD, formatQuotaWithCurrency } from '@/lib/currency'
import { formatNumber } from '@/lib/format'

import type { UserWalletData } from '../types'

interface AffiliateRewardsCardProps {
  user: UserWalletData | null
  affiliateLink: string
  onTransfer: () => void
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard(props: AffiliateRewardsCardProps) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const currencyOptions = {
    locale,
    abbreviate: true,
    digitsLarge: 2,
    digitsSmall: 4,
  }
  const complianceConfirmed = props.complianceConfirmed ?? true
  if (props.loading) {
    return (
      <Card data-card-hover='false' className='bg-muted/20 py-0'>
        <CardContent className='grid gap-4 p-4 sm:p-6'>
          <div>
            <Skeleton className='h-5 w-32' />
            <Skeleton className='mt-2 h-4 w-48' />
          </div>
          <Skeleton className='h-14 rounded-lg' />
          <Skeleton className='h-10 rounded-lg' />
        </CardContent>
      </Card>
    )
  }

  const hasRewards = (props.user?.aff_quota ?? 0) > 0
  const percentageRewardsEnabled = props.user?.affiliate_reward_enabled === true
  const rewardRatio = props.user?.affiliate_reward_ratio ?? 0
  const minimumTopUp = props.user?.affiliate_reward_min_top_up ?? 0
  const inviteeReward = props.user?.affiliate_invitee_reward ?? 0

  return (
    <Card data-card-hover='false' className='bg-muted/20 py-0'>
      <CardContent className='grid min-w-0 gap-6 p-4 sm:p-6'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <IconBadge tone='chart-3'>
            <Share2 />
          </IconBadge>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold'>
              {t('Referral Rewards')}
            </h3>
            <p className='text-muted-foreground text-sm'>
              {percentageRewardsEnabled
                ? t('Earn a percentage when referred users top up.')
                : t(
                    'Earn rewards when users join through your referral link. Transfer accumulated rewards to your balance anytime.'
                  )}
            </p>
          </div>
        </div>

        <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
          {[
            [
              t('Pending'),
              formatQuotaWithCurrency(
                props.user?.aff_quota ?? 0,
                currencyOptions
              ),
            ],
            [
              t('Total Earned'),
              formatQuotaWithCurrency(
                props.user?.aff_history_quota ?? 0,
                currencyOptions
              ),
            ],
            [
              percentageRewardsEnabled
                ? t('Qualified Invites')
                : t('Invited Users'),
              formatNumber(
                percentageRewardsEnabled
                  ? (props.user?.affiliate_qualified_invites ?? 0)
                  : (props.user?.aff_count ?? 0),
                locale
              ),
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className='bg-background/70 min-w-0 rounded-xl border p-4'
            >
              <div className='text-muted-foreground text-xs font-medium'>
                {label}
              </div>
              <div className='mt-2 text-2xl font-semibold break-all tabular-nums'>
                {value}
              </div>
            </div>
          ))}
        </div>

        {percentageRewardsEnabled ? (
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'>
            <span>
              {t('Commission rate')}:{' '}
              <strong className='text-foreground'>
                {formatNumber(rewardRatio, locale)}%
              </strong>
            </span>
            <span>
              {t('Minimum qualifying top-up')}:{' '}
              <strong className='text-foreground'>
                {formatCurrencyFromUSD(minimumTopUp, { locale })}
              </strong>
            </span>
            {inviteeReward > 0 ? (
              <span>
                {t('Invitee reward')}:{' '}
                <strong className='text-foreground'>
                  {formatQuotaWithCurrency(inviteeReward, currencyOptions)}
                </strong>
              </span>
            ) : null}
          </div>
        ) : null}

        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          <Input
            value={props.affiliateLink}
            readOnly
            aria-label={t('Referral link:')}
            className='border-muted bg-background/70 h-10 min-w-0 flex-1 basis-48 font-mono text-xs'
          />
          <CopyButton
            value={props.affiliateLink}
            variant='outline'
            className='bg-background size-9 shrink-0'
            iconClassName='size-4'
            tooltip={t('Copy referral link')}
            aria-label={t('Copy referral link')}
          />
          {hasRewards && (
            <Button
              onClick={props.onTransfer}
              disabled={!complianceConfirmed}
              className='h-9 shrink-0 px-3'
              size='sm'
            >
              {t('Transfer to Balance')}
            </Button>
          )}
        </div>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Rewards can only be transferred to your balance. Cash withdrawal is unavailable.'
          )}
          {percentageRewardsEnabled
            ? ` ${t('Registration alone never creates a reward.')}`
            : ''}
        </p>
        {!complianceConfirmed ? (
          <p className='text-muted-foreground text-sm'>
            {t(
              'Referral reward transfer is disabled until the administrator confirms compliance terms.'
            )}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

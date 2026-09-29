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
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
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
  minimumQuota: number | null
  refreshing?: boolean
  complianceConfirmed?: boolean
  loading?: boolean
}

export function AffiliateRewardsCard(props: AffiliateRewardsCardProps) {
  const { t, i18n } = useTranslation()
  const linkId = useId()
  const transferHintId = useId()
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
  const belowMinimum =
    props.minimumQuota !== null &&
    (props.user?.aff_quota ?? 0) < props.minimumQuota
  const formattedMinimum = formatQuotaWithCurrency(props.minimumQuota, {
    locale,
    abbreviate: false,
    digitsLarge: 6,
    digitsSmall: 10,
  })

  return (
    <Card data-card-hover='false' className='py-0'>
      <CardContent className='grid min-w-0 gap-5 p-4 sm:p-5'>
        <div className='flex min-w-0 flex-col items-start justify-between gap-3 lg:flex-row lg:gap-6'>
          <div className='flex min-w-0 items-start gap-2.5'>
            <IconBadge tone='chart-3'>
              <Share2 aria-hidden='true' />
            </IconBadge>
            <p className='text-muted-foreground max-w-2xl text-sm leading-6'>
              {percentageRewardsEnabled
                ? t(
                    'Invite friends to register through your referral link. Earn rewards when their successful top-ups meet the reward conditions.'
                  )
                : t(
                    'Top-up referral rewards are currently disabled. Existing rewards can still be transferred to your balance.'
                  )}
            </p>
          </div>
          {percentageRewardsEnabled ? (
            <Badge
              variant='outline'
              className='bg-primary/5 h-auto max-w-full flex-wrap gap-x-2 gap-y-0.5 px-3 py-1.5 whitespace-normal'
            >
              <span className='text-muted-foreground'>
                {t('Current commission rate')}
              </span>
              <span className='text-primary text-base font-semibold tabular-nums'>
                {formatNumber(rewardRatio, locale)}%
              </span>
            </Badge>
          ) : null}
        </div>

        <div className='bg-muted/30 rounded-lg'>
          <dl className='grid min-w-0 grid-cols-2 sm:grid-cols-3'>
            <div className='col-span-2 min-w-0 border-b p-4 sm:col-span-1 sm:border-r sm:border-b-0'>
              <dt className='text-muted-foreground text-xs font-medium'>
                {t('Available Rewards')}
              </dt>
              <dd className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-2'>
                <span className='text-2xl font-semibold break-all tabular-nums'>
                  {formatQuotaWithCurrency(
                    props.user?.aff_quota ?? 0,
                    currencyOptions
                  )}
                </span>
                {hasRewards ? (
                  <Button
                    onClick={props.onTransfer}
                    disabled={
                      !complianceConfirmed ||
                      props.minimumQuota === null ||
                      belowMinimum ||
                      props.refreshing
                    }
                    aria-describedby={transferHintId}
                    variant='outline'
                    size='sm'
                  >
                    {t('Transfer to Balance')}
                  </Button>
                ) : null}
              </dd>
            </div>
            {[
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
              <div key={label} className='min-w-0 p-4 last:border-l'>
                <dt className='text-muted-foreground text-xs font-medium'>
                  {label}
                </dt>
                <dd className='mt-2 text-2xl font-semibold break-all tabular-nums'>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p
            id={transferHintId}
            className='text-muted-foreground border-t px-4 py-2.5 text-xs leading-5'
          >
            {props.minimumQuota === null
              ? t('Referral reward transfer is currently unavailable.')
              : `${t('Minimum transfer amount')}: ${formattedMinimum}`}
            {!complianceConfirmed
              ? ` · ${t('Referral reward transfer is disabled until the administrator confirms compliance terms.')}`
              : ''}
          </p>
        </div>

        <div className='min-w-0 space-y-2'>
          <label htmlFor={linkId} className='text-sm font-medium'>
            {t('Referral link:')}
          </label>
          <div className='flex min-w-0 flex-col gap-2 sm:flex-row'>
            <Input
              id={linkId}
              value={props.affiliateLink}
              readOnly
              className='bg-muted/20 h-9 min-w-0 flex-1 font-mono text-xs'
            />
            <CopyButton
              value={props.affiliateLink}
              variant='default'
              size='default'
              className='h-9'
              iconClassName='size-4'
              tooltip={t('Copy referral link')}
              aria-label={t('Copy referral link')}
            >
              {t('Copy referral link')}
            </CopyButton>
          </div>
        </div>

        <div className='text-muted-foreground space-y-1.5 border-t pt-4 text-xs leading-5'>
          {percentageRewardsEnabled ? (
            <>
              <div className='flex flex-wrap gap-x-5 gap-y-1.5'>
                <span>
                  {t('Minimum qualifying top-up')}:{' '}
                  <span className='text-foreground font-medium'>
                    {formatCurrencyFromUSD(minimumTopUp, { locale })}
                  </span>
                </span>
                {inviteeReward > 0 ? (
                  <span>
                    {t('Invitee reward')}:{' '}
                    <span className='text-foreground font-medium'>
                      {formatQuotaWithCurrency(inviteeReward, currencyOptions)}
                    </span>
                  </span>
                ) : null}
              </div>
              <p>
                {t(
                  'Rewards are based on the credited top-up amount and the rate in effect when the top-up succeeds.'
                )}{' '}
                {t('Registration alone never creates a reward.')}
              </p>
            </>
          ) : null}
          <p>
            {t(
              'Rewards can only be transferred to your balance. Cash withdrawal is unavailable.'
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

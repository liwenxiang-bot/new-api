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
import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout/components/section-page-layout'
import { LoadingState } from '@/components/loading-state'
import { getTopupInfo } from '@/features/wallet/api'
import { AffiliateRewardsCard } from '@/features/wallet/components/affiliate-rewards-card'
import { TransferDialog } from '@/features/wallet/components/dialogs/transfer-dialog'
import { useAffiliate } from '@/features/wallet/hooks/use-affiliate'
import type { ApiResponse, UserWalletData } from '@/features/wallet/types'
import { getSelf } from '@/lib/api'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'
import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { RewardsHistory } from './components/rewards-history'

export function Referrals() {
  const { t } = useTranslation()
  const [transferOpen, setTransferOpen] = useState(false)
  const affiliate = useAffiliate()
  const currencyConfig = useSystemConfigStore((state) => state.config.currency)
  const summaryQuery = useQuery({
    queryKey: ['referrals', 'summary'],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      const [profile, topup] = await Promise.all([getSelf(), getTopupInfo()])
      const userResponse = requireServerSuccess(
        profile as ApiResponse<UserWalletData>
      )
      const topupResponse = requireServerSuccess(topup)
      if (!userResponse.data || !topupResponse.data) {
        throw createServerError(
          !userResponse.data ? userResponse : topupResponse
        )
      }
      return {
        user: userResponse.data,
        complianceConfirmed:
          topupResponse.data.payment_compliance_confirmed !== false,
      }
    },
  })
  const loading = summaryQuery.isPending || affiliate.loading
  const summary = summaryQuery.data
  let minimumQuota = summary?.user.affiliate_reward_min_transfer_quota
  if (minimumQuota === undefined) {
    minimumQuota = Math.ceil(
      currencyConfig.quotaPerUnit > 0
        ? currencyConfig.quotaPerUnit
        : DEFAULT_CURRENCY_CONFIG.quotaPerUnit
    )
  }
  if (!Number.isSafeInteger(minimumQuota) || (minimumQuota ?? 0) < 1) {
    minimumQuota = null
  }
  const unavailable =
    summaryQuery.isError || !summary || !affiliate.affiliateLink

  const handleTransfer = async (quota: number): Promise<boolean> => {
    if (!summary?.complianceConfirmed) return false
    const transferred = await affiliate.transferQuota(quota)
    if (transferred) await summaryQuery.refetch()
    return transferred
  }

  let content: ReactNode
  if (loading) {
    content = (
      <div role='status' aria-label={t('Loading...')}>
        <LoadingState />
      </div>
    )
  } else if (unavailable) {
    content = (
      <ErrorState
        onRetry={() => {
          void Promise.all([summaryQuery.refetch(), affiliate.refetch()])
        }}
      />
    )
  } else {
    content = (
      <>
        <AffiliateRewardsCard
          user={summary.user}
          affiliateLink={affiliate.affiliateLink}
          onTransfer={async () => {
            const latest = await summaryQuery.refetch()
            if (!latest.isError) setTransferOpen(true)
          }}
          minimumQuota={minimumQuota}
          refreshing={summaryQuery.isFetching}
          complianceConfirmed={summary.complianceConfirmed}
        />
        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          onConfirm={handleTransfer}
          availableQuota={summary.user.aff_quota}
          minimumQuota={minimumQuota}
          transferring={affiliate.transferring}
        />
      </>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Referral Rewards')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 sm:gap-5'>
          {content}
          <RewardsHistory />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

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
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { Gift } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePagination, DataTableView } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { TitledCard } from '@/components/ui/titled-card'
import { formatQuota, formatTimestampToDate } from '@/lib/format'

import { getReferralRewards, type ReferralReward } from '../api'

const EMPTY_REWARDS: ReferralReward[] = []

export function RewardsHistory() {
  const { t } = useTranslation()
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const rewardsQuery = useQuery({
    queryKey: ['referrals', 'rewards', pagination],
    queryFn: () =>
      getReferralRewards(pagination.pageIndex + 1, pagination.pageSize),
  })
  const columns = useMemo<ColumnDef<ReferralReward>[]>(
    () => [
      { accessorKey: 'invitee_id', header: t('User ID') },
      {
        accessorKey: 'quota',
        header: t('Amount'),
        cell: ({ row }) => formatQuota(row.original.quota),
      },
      {
        accessorKey: 'created_time',
        header: t('Time'),
        cell: ({ row }) => formatTimestampToDate(row.original.created_time),
      },
    ],
    [t]
  )
  const table = useReactTable({
    data: rewardsQuery.data?.items ?? EMPTY_REWARDS,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
    manualPagination: true,
    rowCount: rewardsQuery.data?.total ?? 0,
  })

  return (
    <section
      aria-label={t('Rewards History')}
      aria-busy={rewardsQuery.isFetching}
    >
      <TitledCard
        title={t('Rewards History')}
        icon={<Gift aria-hidden='true' />}
        disableHoverEffect
      >
        {rewardsQuery.isError ? (
          <ErrorState onRetry={() => void rewardsQuery.refetch()} />
        ) : (
          <div className='min-w-0 space-y-4'>
            <DataTableView
              table={table}
              isLoading={rewardsQuery.isPending}
              tableContainerClassName='overflow-x-auto'
              tableClassName='min-w-[420px]'
              emptyContent={
                <EmptyState
                  icon={Gift}
                  title={t('No referral rewards yet')}
                  description={t(
                    "Your rewards will appear here after a referred user's qualifying top-up."
                  )}
                />
              }
            />
            {!rewardsQuery.isPending && (
              <DataTablePagination table={table} compact />
            )}
          </div>
        )}
      </TitledCard>
    </section>
  )
}

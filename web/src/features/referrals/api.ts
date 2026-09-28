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
import type { ApiResponse } from '@/features/wallet/types'
import { api } from '@/lib/api'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'

export interface ReferralReward {
  id: number
  invitee_id: number
  quota: number
  created_time: number
}

export interface ReferralRewardsPage {
  items: ReferralReward[]
  total: number
}

export async function getReferralRewards(
  page: number,
  pageSize: number
): Promise<ReferralRewardsPage> {
  const response = await api.get<ApiResponse<ReferralRewardsPage>>(
    '/api/user/self/affiliate_rewards',
    {
      params: { p: page, page_size: pageSize },
    }
  )
  const result = requireServerSuccess(response.data)
  if (!result.data || !Array.isArray(result.data.items)) {
    throw createServerError(result)
  }
  return result.data
}

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
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { toIntlLocale } from '@/i18n/languages'
import { formatLocalCurrencyAmount } from '@/lib/currency'

import type { InvoiceStatus } from '../types'

export function InvoiceAmount(props: { minor: number; currency: string }) {
  const { i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  return (
    <span className='whitespace-nowrap tabular-nums'>
      {formatLocalCurrencyAmount(props.minor / 100, {
        showSymbol: false,
        digitsLarge: 2,
        digitsSmall: 2,
        abbreviate: false,
        locale,
      })}{' '}
      {props.currency}
    </span>
  )
}

export function InvoiceStatusBadge(props: { status: InvoiceStatus }) {
  const { t } = useTranslation()
  const labels = {
    pending: t('Pending review'),
    approved: t('Awaiting invoice'),
    rejected: t('Rejected'),
    issued: t('Invoice issued'),
  }
  return (
    <Badge variant={props.status === 'rejected' ? 'destructive' : 'secondary'}>
      {labels[props.status]}
    </Badge>
  )
}

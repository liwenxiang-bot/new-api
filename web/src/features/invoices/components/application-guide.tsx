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
import { FileText, Info } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { TitledCard } from '@/components/ui/titled-card'

import { InvoiceAmount } from './invoice-display'

export function InvoiceApplicationGuide(props: { minAmountMinor: number }) {
  const { t } = useTranslation()
  const titleId = useId()
  const guidance = [
    {
      title: t('Eligible recharge orders only'),
      description: t(
        'Only the eligible recharge orders listed in the application can be invoiced. Rewards, redemption codes and subscription purchases are excluded.'
      ),
    },
    {
      title: t('Invoice amount'),
      description: t(
        'The invoice amount is based on the actual payment for the selected orders.'
      ),
    },
    {
      title: t('Invoice types and details'),
      description: t(
        'Only ordinary VAT invoices are currently supported, with personal or company titles. Company titles require a taxpayer ID.'
      ),
    },
    {
      title: t('Review and download'),
      description: t(
        'After submission, an administrator will review your application. Once issued, download the PDF from the application details.'
      ),
    },
  ]

  return (
    <section aria-labelledby={titleId} className='min-w-0'>
      <TitledCard
        title={<h3 id={titleId}>{t('Invoice application guide')}</h3>}
        icon={<FileText aria-hidden='true' />}
        iconTone='primary'
        titleClassName='text-sm sm:text-base'
        headerClassName='bg-muted/20'
        disableHoverEffect
        action={
          <div className='flex min-w-0 flex-col items-start gap-1.5 sm:items-end'>
            <Badge
              variant='secondary'
              className='h-auto max-w-full flex-wrap gap-x-2 px-3 py-1.5 whitespace-normal'
            >
              {props.minAmountMinor > 0 ? (
                <>
                  <span>{t('Minimum invoice amount')}</span>
                  <InvoiceAmount minor={props.minAmountMinor} currency='CNY' />
                </>
              ) : (
                t('No minimum invoice amount')
              )}
            </Badge>
            {props.minAmountMinor > 0 ? (
              <p className='text-muted-foreground text-xs'>
                {t('Combine eligible recharge orders to reach this amount.')}
              </p>
            ) : null}
          </div>
        }
        contentClassName='flex flex-col gap-5'
      >
        <dl className='grid min-w-0 gap-x-8 gap-y-5 md:grid-cols-2'>
          {guidance.map((item) => (
            <div key={item.title} className='min-w-0'>
              <dt className='text-sm font-medium'>{item.title}</dt>
              <dd className='text-muted-foreground mt-1.5 text-sm leading-6'>
                {item.description}
              </dd>
            </div>
          ))}
        </dl>
        <Alert role='note' className='bg-muted/30'>
          <Info aria-hidden='true' />
          <AlertDescription className='text-xs leading-5'>
            {t(
              'Check your invoice title, taxpayer ID and contact email before submitting. If any details are incorrect, contact the administrator; if rejected, check the reason and apply again.'
            )}
          </AlertDescription>
        </Alert>
      </TitledCard>
    </section>
  )
}

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
import { Link } from '@tanstack/react-router'
import { ArrowRight, CircleHelp, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { GroupBadge, GroupMultiplierBadge } from '@/components/group-badge'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getPricing } from '@/features/pricing/api'
import { filterByGroup } from '@/features/pricing/lib/filters'
import { getUserGroups } from '@/lib/api'

import type { ApiKeyCreationPreset } from '../../types'

const GUIDE_STEPS = [
  { app: 'Claude Code', group: 'cc-max', name: 'claude-code' },
  { app: 'Codex', group: 'codex', name: 'codex' },
] as const

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (preset: ApiKeyCreationPreset) => void
}

export function ApiKeyCreationGuideDialog(props: Props) {
  const { t } = useTranslation()
  const [step, setStep] = useState(0)
  const current = GUIDE_STEPS[step]
  const pricing = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    enabled: props.open,
    staleTime: 0,
  })
  const groups = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    enabled: props.open,
    staleTime: 0,
  })
  const groupAvailable =
    groups.data?.success === true &&
    Object.hasOwn(groups.data.data ?? {}, current.group)
  const groupsFailed = groups.isError || groups.data?.success === false
  const pricingFailed = pricing.isError || pricing.data?.success === false
  const models = useMemo(
    () =>
      [
        ...new Set(
          filterByGroup(pricing.data?.data ?? [], current.group).map(
            (model) => model.model_name
          )
        ),
      ].sort(),
    [current.group, pricing.data?.data]
  )
  const groupRatio = Number(groups.data?.data?.[current.group]?.ratio)
  const canCreate = groupAvailable && !groupsFailed && !groups.isFetching

  let modelsContent
  if (pricing.isPending) {
    modelsContent = (
      <LoadingState className='min-h-28' message={t('Loading models...')} />
    )
  } else if (pricingFailed) {
    modelsContent = (
      <ErrorState
        className='min-h-0 py-4'
        title={t('Failed to load models')}
        onRetry={() => {
          void pricing.refetch()
        }}
      />
    )
  } else if (models.length === 0) {
    modelsContent = (
      <EmptyState
        className='min-h-0 py-4'
        title={t('No models are currently available in this group.')}
      />
    )
  } else {
    modelsContent = (
      <div
        role='region'
        aria-label={t('{{group}} available models', { group: current.group })}
        tabIndex={0}
        className='focus-visible:ring-ring flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-md p-1 focus-visible:ring-2'
      >
        {models.map((model) => (
          <Badge
            key={model}
            variant='outline'
            className='h-auto max-w-full py-1 font-mono font-normal break-all whitespace-normal'
          >
            {model}
          </Badge>
        ))}
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('API Key Creation Guide')}
      description={t(
        'Create separate keys with the groups required by each coding client.'
      )}
      contentClassName='sm:max-w-2xl'
      bodyClassName='space-y-5'
      footer={
        <div className='flex w-full flex-col gap-2 sm:flex-row sm:justify-between'>
          <Button variant='outline' onClick={() => setStep(step === 0 ? 1 : 0)}>
            {step === 0 ? t('Next') : t('Previous')}
          </Button>
          <Button
            disabled={!canCreate}
            onClick={() => {
              if (canCreate) {
                props.onCreate({ name: current.name, group: current.group })
              }
            }}
          >
            {t('Create {{app}} key', { app: current.app })}
            <ArrowRight aria-hidden='true' className='size-4' />
          </Button>
        </div>
      }
    >
      <Tabs
        value={String(step)}
        onValueChange={(value) => setStep(Number(value))}
        className='gap-5'
      >
        <TabsList className='h-auto w-full p-1' aria-label={t('Application')}>
          {GUIDE_STEPS.map((item, index) => (
            <TabsTrigger
              key={item.group}
              value={String(index)}
              className='min-h-10 gap-2'
            >
              <span
                aria-hidden='true'
                className='bg-primary/10 text-primary flex size-5 items-center justify-center rounded-full text-xs'
              >
                {index + 1}
              </span>
              {item.app}
            </TabsTrigger>
          ))}
        </TabsList>
        {GUIDE_STEPS.map((item, index) => (
          <TabsContent
            key={item.group}
            value={String(index)}
            className='space-y-4'
          >
            <div className='bg-muted/40 flex items-center gap-3 rounded-xl border p-4'>
              <CircleHelp
                aria-hidden='true'
                className='text-primary size-6 shrink-0'
              />
              <div className='min-w-0 space-y-1'>
                <h3 className='font-semibold'>
                  {t('Create {{app}} key', { app: item.app })}
                </h3>
                <p className='text-muted-foreground'>
                  {t('Use the {{group}} group for {{app}} requests.', {
                    group: item.group,
                    app: item.app,
                  })}
                </p>
              </div>
            </div>
            <ol className='grid gap-3 sm:grid-cols-2'>
              <li className='space-y-2 rounded-xl border p-4'>
                <p className='text-muted-foreground'>1. {t('Name')}</p>
                <code className='font-medium'>{item.name}</code>
              </li>
              <li className='space-y-2 rounded-xl border p-4'>
                <p className='text-muted-foreground'>2. {t('Group')}</p>
                <div className='flex flex-wrap items-center gap-2'>
                  <GroupBadge group={item.group} />
                  {groupAvailable && Number.isFinite(groupRatio) && (
                    <GroupMultiplierBadge ratio={groupRatio} />
                  )}
                </div>
              </li>
              <li className='rounded-xl border p-4 sm:col-span-2'>
                <p>3. {t('Review quota and expiration before saving.')}</p>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {t(
                    'The creation form will prefill the name and group. You can review all settings before saving.'
                  )}
                </p>
              </li>
            </ol>
          </TabsContent>
        ))}
      </Tabs>

      {groupsFailed && (
        <ErrorState
          className='min-h-0 py-3'
          title={t('Failed to load groups')}
          onRetry={() => {
            void groups.refetch()
          }}
        />
      )}
      {!groupsFailed && !groups.isPending && !groupAvailable && (
        <p role='alert' className='text-destructive text-sm'>
          {t('The {{group}} group is not available for this account.', {
            group: current.group,
          })}
        </p>
      )}
      <section
        className='space-y-3 rounded-xl border p-4'
        aria-busy={pricing.isFetching}
      >
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h3 className='text-sm font-medium'>
            {t('{{group}} available models', { group: current.group })}
          </h3>
          <Button
            size='sm'
            variant='link'
            role='link'
            className='h-auto p-0'
            render={
              <Link
                to='/pricing'
                search={{ group: current.group }}
                target='_blank'
                rel='noopener noreferrer'
              />
            }
          >
            {t('Model Plaza')}
            <ExternalLink aria-hidden='true' className='size-3.5' />
          </Button>
        </div>
        {modelsContent}
      </section>
      <p className='text-muted-foreground text-sm'>
        {t(
          'After creating the key, use CC Switch in the key list to configure your client.'
        )}
      </p>
    </Dialog>
  )
}

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
import type { TFunction } from 'i18next'
import { Bell, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { RichContent } from '@/components/rich-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'

interface AnnouncementItem {
  id?: number | string
  type?: string
  content?: string
  extra?: string
  publishDate?: string | Date
}

interface NotificationPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unreadCount: number
  activeTab: 'notice' | 'announcements'
  onTabChange: (tab: 'notice' | 'announcements') => void
  notice: string
  announcements: AnnouncementItem[]
  loading: boolean
  className?: string
}

/**
 * Get relative time string from a date
 */
function getRelativeTime(publishDate: string | Date, t: TFunction): string {
  if (!publishDate) return ''

  const now = new Date()
  const pubDate = new Date(publishDate)

  // If invalid date, return original string
  if (Number.isNaN(pubDate.getTime())) {
    return typeof publishDate === 'string' ? publishDate : ''
  }

  const diffMs = now.getTime() - pubDate.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  // If future time, show specific date
  if (diffMs < 0) return formatDateTimeObject(pubDate)

  // Return relative time based on difference
  if (diffSeconds < 60) return t('Just now')
  if (diffMinutes < 60) {
    return diffMinutes === 1
      ? t('1 minute ago')
      : t('{{count}} minutes ago', { count: diffMinutes })
  }
  if (diffHours < 24) {
    return diffHours === 1
      ? t('1 hour ago')
      : t('{{count}} hours ago', { count: diffHours })
  }
  if (diffDays < 7) {
    return diffDays === 1
      ? t('1 day ago')
      : t('{{count}} days ago', { count: diffDays })
  }
  if (diffWeeks < 4) {
    return diffWeeks === 1
      ? t('1 week ago')
      : t('{{count}} weeks ago', { count: diffWeeks })
  }
  if (diffMonths < 12) {
    return diffMonths === 1
      ? t('1 month ago')
      : t('{{count}} months ago', { count: diffMonths })
  }
  if (diffYears < 2) return t('1 year ago')

  // Over 2 years, show specific date
  return formatDateTimeObject(pubDate)
}

/**
 * Announcement status dot indicator
 */
function AnnouncementDot({ type }: { type?: string }) {
  return (
    <span
      className={cn(
        'absolute top-1.5 left-0 inline-block size-2 rounded-full',
        getAnnouncementColorClass(type)
      )}
    />
  )
}

function getAnnouncementRenderKey(announcement: AnnouncementItem): string {
  if (announcement.id !== undefined && announcement.id !== null) {
    return `id:${announcement.id}`
  }

  return JSON.stringify({
    content: announcement.content ?? '',
    extra: announcement.extra ?? '',
    publishDate: announcement.publishDate ?? '',
    type: announcement.type ?? '',
  })
}

/**
 * Empty state component
 */
function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <Empty className='min-h-48 border-0 p-4'>
      <EmptyHeader>
        <EmptyMedia variant='icon'>{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
    </Empty>
  )
}

/**
 * Notice tab content
 */
function NoticeContent({
  notice,
  loading,
  t,
}: {
  notice: string
  loading: boolean
  t: TFunction
}) {
  if (loading) {
    return (
      <EmptyState
        icon={<Bell />}
        title={t('Loading...')}
        description={t('Latest platform updates and notices')}
      />
    )
  }

  if (!notice) {
    return (
      <EmptyState icon={<Bell />} title={t('No announcements at this time')} />
    )
  }

  return (
    <ScrollArea className='h-full pr-3'>
      <RichContent breaks content={notice} className='prose-base' />
    </ScrollArea>
  )
}

/**
 * Announcements tab content
 */
function AnnouncementsContent({
  announcements,
  loading,
  t,
}: {
  announcements: AnnouncementItem[]
  loading: boolean
  t: TFunction
}) {
  if (loading) {
    return (
      <EmptyState
        icon={<Megaphone />}
        title={t('Loading...')}
        description={t('Latest platform updates and notices')}
      />
    )
  }

  if (announcements.length === 0) {
    return (
      <EmptyState icon={<Megaphone />} title={t('No system announcements')} />
    )
  }

  return (
    <ScrollArea className='h-full pr-3'>
      <div className='relative flex flex-col'>
        {announcements.map((item) => {
          const announcementKey = getAnnouncementRenderKey(item)
          const publishDate = item.publishDate
            ? new Date(item.publishDate)
            : null
          const relativeTime = publishDate
            ? getRelativeTime(publishDate, t)
            : ''
          const absoluteTime = publishDate
            ? formatDateTimeObject(publishDate)
            : ''

          return (
            <div
              key={announcementKey}
              className='before:bg-border relative pb-8 pl-8 before:absolute before:top-3 before:bottom-0 before:left-[3px] before:w-px last:pb-2 last:before:hidden'
            >
              <AnnouncementDot type={item.type} />
              <div className='flex min-w-0 flex-col gap-2'>
                <div className='text-base leading-7'>
                  <RichContent breaks content={item.content || ''} />
                </div>

                {item.extra ? (
                  <div className='text-muted-foreground text-sm'>
                    <RichContent breaks content={item.extra} />
                  </div>
                ) : null}

                {absoluteTime ? (
                  <div className='text-muted-foreground text-sm'>
                    {relativeTime ? `${relativeTime} • ` : null}
                    {absoluteTime}
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

/**
 * Notification center with Notice and Announcements tabs
 */
export function NotificationPopover({
  open,
  onOpenChange,
  unreadCount,
  activeTab,
  onTabChange,
  notice,
  announcements,
  loading,
  className,
}: NotificationPopoverProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            className={cn('relative size-9', className)}
            aria-label={t('Notifications')}
          />
        }
      >
        <Bell className='size-[1.2rem]' />
        {unreadCount > 0 ? (
          <Badge
            variant='destructive'
            className='absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] font-semibold tabular-nums'
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        ) : null}
      </DialogTrigger>

      <DialogContent
        showCloseButton
        overlayClassName='bg-black/45 backdrop-blur-[2px]'
        className='flex h-[min(88vh,52rem)] w-[min(90vw,72rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none'
      >
        <Tabs
          value={activeTab}
          onValueChange={onTabChange as (value: string) => void}
          className='min-h-0 flex-1 gap-0'
        >
          <div className='flex shrink-0 flex-col gap-4 border-b px-6 py-5 pr-14 sm:flex-row sm:items-center sm:justify-between'>
            <DialogTitle className='text-2xl font-semibold tracking-tight'>
              {t('System Announcements')}
            </DialogTitle>

            <TabsList className='grid h-11 w-full grid-cols-2 rounded-full p-1 sm:max-w-[26rem]'>
              <TabsTrigger value='notice' className='gap-1.5 rounded-full'>
                <Bell className='size-3.5' />
                {t('Notice')}
              </TabsTrigger>
              <TabsTrigger
                value='announcements'
                className='gap-1.5 rounded-full'
              >
                <Megaphone className='size-3.5' />
                {t('Timeline')}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className='min-h-0 flex-1 px-6 py-5'>
            <TabsContent value='notice' className='mt-0 h-full'>
              <NoticeContent notice={notice} loading={loading} t={t} />
            </TabsContent>

            <TabsContent value='announcements' className='mt-0 h-full'>
              <AnnouncementsContent
                announcements={announcements}
                loading={loading}
                t={t}
              />
            </TabsContent>
          </div>
        </Tabs>

        <div className='flex shrink-0 justify-end border-t px-6 py-4'>
          <Button
            size='sm'
            variant='secondary'
            onClick={() => onOpenChange(false)}
          >
            {t('Close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

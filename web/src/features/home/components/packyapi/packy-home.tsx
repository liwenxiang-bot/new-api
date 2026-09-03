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
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { Cta } from './Cta'
import { HERO } from './data/content'
import { Ecosystem } from './Ecosystem'
import { Features } from './Features'
import { Hero } from './Hero'
import { HowItWorks } from './HowItWorks'

import './packy-home.css'

interface PackyHomeProps {
  isAuthenticated: boolean
}

function normalizeBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    if (
      ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname)
    ) {
      return null
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function PackyHome(props: PackyHomeProps) {
  const { t } = useTranslation()
  const { status } = useStatus()

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('packy-snap-enabled')

    return () => {
      root.classList.remove('packy-snap-enabled')
    }
  }, [])

  const statusData = status?.data
  const configuredBaseUrl = normalizeBaseUrl(
    status?.server_address ?? statusData?.server_address
  )
  const browserBaseUrl =
    typeof window === 'undefined' ? HERO.baseUrl : window.location.origin
  const baseUrl = configuredBaseUrl ?? browserBaseUrl
  const docsUrl =
    (status?.docs_link as string | undefined) ||
    (statusData?.docs_link as string | undefined) ||
    HERO.secondaryHref
  const registerEnabled =
    status?.register_enabled ?? statusData?.register_enabled
  const selfUseModeEnabled =
    status?.self_use_mode_enabled ?? statusData?.self_use_mode_enabled
  const registrationRestricted =
    registerEnabled === false || selfUseModeEnabled === true
  let primaryHref: '/dashboard' | '/sign-up' | '/sign-in' = '/sign-up'
  if (props.isAuthenticated) {
    primaryHref = '/dashboard'
  } else if (registrationRestricted) {
    primaryHref = '/sign-in'
  }

  let heroPrimaryHref: '/keys' | '/sign-up' | '/sign-in' = '/sign-up'
  if (props.isAuthenticated) {
    heroPrimaryHref = '/keys'
  } else if (registrationRestricted) {
    heroPrimaryHref = '/sign-in'
  }

  return (
    <div className='packy-home'>
      <div className='packy-page'>
        <Hero
          baseUrl={baseUrl}
          docsUrl={docsUrl}
          primaryHref={heroPrimaryHref}
        />
      </div>
      <div className='packy-page'>
        <Features />
      </div>
      <div className='packy-page'>
        <HowItWorks />
      </div>
      <div className='packy-page'>
        <Ecosystem />
      </div>
      <div className='packy-page'>
        <Cta docsUrl={docsUrl} primaryHref={primaryHref} />
      </div>
      <span className='sr-only'>{t('Home')}</span>
    </div>
  )
}

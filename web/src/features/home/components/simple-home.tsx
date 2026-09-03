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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BarChart3,
  Code2,
  KeyRound,
  Route,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

import { Hero } from './sections/hero'

interface SimpleHomeProps {
  isAuthenticated: boolean
}

export function SimpleHome(props: SimpleHomeProps) {
  const { t } = useTranslation()
  const { status } = useStatus()

  const isAuthenticated = props.isAuthenticated
  const registerEnabled =
    status?.register_enabled ?? status?.data?.register_enabled
  const selfUseModeEnabled =
    status?.self_use_mode_enabled ?? status?.data?.self_use_mode_enabled
  let primaryHref = '/sign-up'
  let primaryLabel = t('Get Started')
  if (isAuthenticated) {
    primaryHref = '/dashboard'
    primaryLabel = t('Go to Dashboard')
  } else if (registerEnabled === false || selfUseModeEnabled === true) {
    primaryHref = '/sign-in'
    primaryLabel = t('Sign in')
  }

  const features = [
    {
      icon: Route,
      title: t('Routing & Overrides'),
      description: t('Create channels or edit keys, base URLs, and overrides.'),
    },
    {
      icon: Code2,
      title: t('Model Access'),
      description: t(
        'Compatible API routes for common AI application workflows'
      ),
    },
    {
      icon: KeyRound,
      title: t('Secure & Reliable'),
      description: t(
        'Add your API keys, set up channels and configure access permissions'
      ),
    },
    {
      icon: BarChart3,
      title: t('Usage'),
      description: t(
        'Track usage, costs and performance with real-time analytics'
      ),
    },
  ]

  const steps = [
    {
      icon: Settings2,
      number: '01',
      title: t('Select Model'),
      description: t('Browse available models and pricing'),
    },
    {
      icon: ShieldCheck,
      number: '02',
      title: t('Create API Key'),
      description: t('Create a key for your app or service'),
    },
    {
      icon: Code2,
      number: '03',
      title: t('Connect'),
      description: t(
        'Use our unified OpenAI-compatible endpoint in your applications'
      ),
    },
  ]

  return (
    <main>
      <Hero isAuthenticated={isAuthenticated} />

      <section className='px-6 py-16 md:py-20'>
        <div className='mx-auto max-w-6xl'>
          <AnimateInView className='mb-8 max-w-xl'>
            <p className='text-muted-foreground mb-2 text-xs font-medium tracking-[0.18em] uppercase'>
              {t('Core Features')}
            </p>
            <h2 className='text-2xl font-semibold tracking-tight md:text-3xl'>
              {t('Built for developers,')} {t('designed for scale')}
            </h2>
          </AnimateInView>

          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <AnimateInView
                  key={feature.title}
                  delay={index * 60}
                  animation='fade-up'
                  className='border-border bg-card rounded-xl border p-5 shadow-xs'
                >
                  <div className='bg-primary/10 text-primary mb-5 flex size-9 items-center justify-center rounded-lg'>
                    <Icon className='size-4' strokeWidth={1.8} />
                  </div>
                  <h3 className='text-sm font-semibold'>{feature.title}</h3>
                  <p className='text-muted-foreground mt-2 text-sm leading-6'>
                    {feature.description}
                  </p>
                </AnimateInView>
              )
            })}
          </div>
        </div>
      </section>

      <section className='border-border/60 bg-muted/15 border-y px-6 py-16 md:py-20'>
        <div className='mx-auto max-w-6xl'>
          <AnimateInView className='mb-8 text-center'>
            <p className='text-muted-foreground mb-2 text-xs font-medium tracking-[0.18em] uppercase'>
              {t('How It Works')}
            </p>
            <h2 className='text-2xl font-semibold tracking-tight md:text-3xl'>
              {t('Three steps to get started')}
            </h2>
          </AnimateInView>

          <div className='grid gap-3 md:grid-cols-3'>
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <AnimateInView
                  key={step.number}
                  delay={index * 80}
                  animation='fade-up'
                  className='border-border bg-background rounded-xl border p-5'
                >
                  <div className='mb-6 flex items-center justify-between'>
                    <div className='bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg'>
                      <Icon className='size-4' strokeWidth={1.8} />
                    </div>
                    <span className='text-muted-foreground/60 font-mono text-xs'>
                      {step.number}
                    </span>
                  </div>
                  <h3 className='text-sm font-semibold'>{step.title}</h3>
                  <p className='text-muted-foreground mt-2 text-sm leading-6'>
                    {step.description}
                  </p>
                </AnimateInView>
              )
            })}
          </div>
        </div>
      </section>

      <section className='px-6 py-16 md:py-20'>
        <AnimateInView className='border-border bg-card mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl border p-7 shadow-xs md:flex-row md:items-center md:p-9'>
          <div>
            <h2 className='text-xl font-semibold tracking-tight md:text-2xl'>
              {t('Build on your API gateway in minutes')}
            </h2>
            <p className='text-muted-foreground mt-2 max-w-xl text-sm leading-6'>
              {t(
                'Use our unified OpenAI-compatible endpoint in your applications'
              )}
            </p>
          </div>
          <div className='flex shrink-0 flex-wrap gap-3'>
            <Button
              className='group h-10 rounded-lg px-4'
              render={<Link to={primaryHref} />}
            >
              {primaryLabel}
              <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
            </Button>
            {!isAuthenticated && (
              <Button
                variant='outline'
                className='h-10 rounded-lg px-4'
                render={<Link to='/pricing' />}
              >
                {t('View Pricing')}
              </Button>
            )}
          </div>
        </AnimateInView>
      </section>
    </main>
  )
}

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
  BookOpen,
  Check,
  Code2,
  Copy,
  KeyRound,
  Route,
  Settings2,
  ShieldCheck,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'

interface SimpleHomeProps {
  isAuthenticated: boolean
}

function DocsButton(props: { href: string; label: string }) {
  const isExternal = props.href.startsWith('http')

  if (isExternal) {
    return (
      <Button
        variant='outline'
        className='h-10 rounded-lg px-4'
        render={
          <a href={props.href} target='_blank' rel='noopener noreferrer' />
        }
      >
        <BookOpen className='size-4' />
        {props.label}
      </Button>
    )
  }

  return (
    <Button
      variant='outline'
      className='h-10 rounded-lg px-4'
      render={<Link to={props.href} />}
    >
      <BookOpen className='size-4' />
      {props.label}
    </Button>
  )
}

function ApiPreview() {
  const { t } = useTranslation()

  return (
    <div className='border-border bg-card overflow-hidden rounded-2xl border shadow-xs'>
      <div className='border-border flex items-center justify-between border-b px-4 py-3'>
        <div className='flex items-center gap-2'>
          <span className='bg-primary/80 size-2 rounded-full' aria-hidden />
          <span className='text-sm font-medium'>{t('API')}</span>
        </div>
        <span className='text-muted-foreground text-xs'>
          {t('Multi-protocol Compatible')}
        </span>
      </div>

      <div className='bg-muted/20 p-4'>
        <div className='mb-3 flex items-center justify-between gap-3'>
          <span className='text-muted-foreground text-xs'>
            {t(
              'Use our unified OpenAI-compatible endpoint in your applications'
            )}
          </span>
          <span className='bg-primary/10 text-primary shrink-0 rounded-md px-2 py-1 font-mono text-[10px] font-semibold'>
            POST
          </span>
        </div>

        <div className='border-border bg-background rounded-lg border p-3 font-mono text-xs'>
          <div className='text-muted-foreground mb-3 flex flex-wrap gap-x-2 gap-y-1'>
            <span>/v1/chat/completions</span>
          </div>
          <pre className='text-foreground/80 overflow-x-auto leading-6 whitespace-pre-wrap'>{`{
  "model": "your-model",
  "messages": [{ "role": "user", "content": "..." }]
}`}</pre>
        </div>

        <div className='text-muted-foreground mt-3 flex items-center gap-2 text-xs'>
          <Check className='text-primary size-3.5' />
          <span>
            {t('Complete API documentation with multi-language SDK support')}
          </span>
        </div>
      </div>
    </div>
  )
}

function EndpointCopy(props: { baseUrl: string }) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({
    notify: true,
    successMessage: t('Copied'),
  })
  const copied = copiedText === props.baseUrl

  return (
    <div className='border-border bg-card mt-8 w-full max-w-xl rounded-xl border p-3 shadow-xs'>
      <div className='text-muted-foreground mb-2 flex min-w-0 items-center gap-3 text-xs'>
        <span className='shrink-0'>{t('Server Address')}</span>
        <span className='text-muted-foreground/60 min-w-0 flex-1 truncate text-right text-[10px]'>
          {t('OpenAI')}: /v1
        </span>
      </div>
      <div className='border-border bg-muted/20 flex items-center gap-2 rounded-lg border px-3 py-2'>
        <code className='text-foreground/80 min-w-0 flex-1 truncate font-mono text-xs sm:text-sm'>
          {props.baseUrl}
        </code>
        <button
          type='button'
          className='text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:ring-2'
          onClick={() => void copyToClipboard(props.baseUrl)}
          aria-label={copied ? t('Copied') : t('Copy URL')}
        >
          {copied ? (
            <Check className='text-primary size-4' />
          ) : (
            <Copy className='size-4' />
          )}
        </button>
      </div>
    </div>
  )
}

export function SimpleHome(props: SimpleHomeProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { systemName, logo } = useSystemConfig()

  const isAuthenticated = props.isAuthenticated
  const docsUrl =
    (status?.docs_link as string | undefined) || 'https://docs.newapi.pro'
  const addressCandidate =
    (status as Record<string, unknown> | null)?.server_address ??
    (status as Record<string, unknown> | null)?.serverAddress ??
    (status?.data as Record<string, unknown> | undefined)?.server_address ??
    (status?.data as Record<string, unknown> | undefined)?.serverAddress
  const configuredAddress =
    typeof addressCandidate === 'string' ? addressCandidate.trim() : ''
  const fallbackBaseUrl =
    typeof window === 'undefined'
      ? 'https://your-domain.example'
      : window.location.origin
  let baseUrl = fallbackBaseUrl
  if (configuredAddress) {
    try {
      const hostname = new URL(configuredAddress).hostname.toLowerCase()
      const isLoopback = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '[::1]',
      ].includes(hostname)
      if (!isLoopback) {
        baseUrl = configuredAddress
      }
    } catch {
      baseUrl = configuredAddress
    }
  }
  baseUrl = baseUrl.replace(/\/+$/, '')
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

  const capabilities = [
    t('Multi-protocol Compatible'),
    t('Routing & Overrides'),
    t('Rate Limiting'),
    t('Transparent Billing'),
  ]

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
      <section className='border-border/60 relative border-b px-6 pt-28 pb-16 md:pt-36 md:pb-24'>
        <div className='mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16'>
          <AnimateInView className='max-w-2xl min-w-0' animation='fade-right'>
            <div className='border-border bg-muted/40 text-muted-foreground mb-6 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs'>
              <img
                src={logo}
                alt=''
                className='size-4 shrink-0 rounded object-cover'
                aria-hidden
              />
              <span className='min-w-0 truncate font-medium'>{systemName}</span>
              <span className='text-border hidden sm:inline'>/</span>
              <span className='hidden shrink-0 sm:inline'>
                {t('Powerful API Management Platform')}
              </span>
            </div>

            <h1 className='text-4xl leading-[1.2] font-semibold tracking-tight md:text-5xl'>
              {t('Unified API Gateway for')}
              <span className='text-primary mt-2 block'>
                {t('Vast Range of AI Models')}
              </span>
            </h1>
            <p className='text-muted-foreground mt-6 max-w-xl text-base leading-7 md:text-lg'>
              {t(
                'A focused home for keys, balance, routing, and service health.'
              )}
            </p>

            <div className='mt-8 flex flex-wrap items-center gap-3'>
              <Button
                className='group h-10 rounded-lg px-4'
                render={<Link to={primaryHref} />}
              >
                {primaryLabel}
                <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
              </Button>
              <DocsButton href={docsUrl} label={t('Docs')} />
              {!isAuthenticated && (
                <Button
                  variant='ghost'
                  className='h-10 rounded-lg px-3'
                  render={<Link to='/pricing' />}
                >
                  {t('View Pricing')}
                </Button>
              )}
            </div>

            <EndpointCopy baseUrl={baseUrl} />

            <div className='mt-10 flex flex-wrap gap-2'>
              {capabilities.map((capability) => (
                <span
                  key={capability}
                  className='border-border text-muted-foreground rounded-md border bg-transparent px-2.5 py-1.5 text-xs'
                >
                  {capability}
                </span>
              ))}
            </div>
          </AnimateInView>

          <AnimateInView className='min-w-0' animation='fade-left' delay={120}>
            <ApiPreview />
          </AnimateInView>
        </div>
      </section>

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

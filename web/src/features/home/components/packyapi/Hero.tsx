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
import { useTranslation } from 'react-i18next'

import { CopyField } from './CopyField'
import { HERO, STATS, HERO_CARDS, ENDPOINTS } from './data/content'
import { ICONS, IconPlay, IconDoc, IconExternal, type IconKey } from './Icons'

interface HeroProps {
  baseUrl: string
  docsUrl: string
  primaryHref: '/keys' | '/sign-up' | '/sign-in'
}

export function Hero(props: HeroProps) {
  const { t } = useTranslation()

  return (
    <section
      className='relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden'
      style={{ background: 'var(--bg-0)' }}
    >
      {/* 背景光晕 */}
      <div className='pointer-events-none absolute inset-0 overflow-hidden'>
        <div
          className='absolute -top-24 -left-32 h-[420px] w-[420px] rounded-full blur-3xl'
          style={{
            background:
              'radial-gradient(circle, var(--glow-1) 0%, transparent 70%)',
          }}
        />
        <div
          className='absolute -right-24 -bottom-20 h-[360px] w-[360px] rounded-full blur-3xl'
          style={{
            background:
              'radial-gradient(circle, var(--glow-2) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className='relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col justify-start px-5 pt-24 pb-12 md:justify-center md:px-6 md:pt-32 lg:px-8'>
        <div className='grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]'>
          {/* 左列 */}
          <div className='flex flex-col gap-6 md:gap-7'>
            <span
              className='landing-fade-up self-start rounded-full border px-3.5 py-1 text-xs font-medium tracking-widest uppercase'
              style={{
                animationDelay: '0ms',
                borderColor:
                  'color-mix(in srgb, var(--primary) 35%, transparent)',
                background:
                  'color-mix(in srgb, var(--primary) 12%, transparent)',
                color: 'var(--primary)',
              }}
            >
              {t(HERO.badge)}
            </span>

            <h1
              className='landing-fade-up text-4xl leading-tight font-bold tracking-wide sm:text-5xl lg:text-5xl'
              style={{ animationDelay: '60ms', color: 'var(--text-0)' }}
            >
              {t(HERO.titleLine1)}
              <br />
              <span className='shine-text'>{t(HERO.titleLine2)}</span>
            </h1>

            <p
              className='landing-fade-up max-w-xl text-base leading-relaxed'
              style={{ animationDelay: '120ms', color: 'var(--text-1)' }}
            >
              {t(HERO.subtitle)}
            </p>

            <div
              className='landing-fade-up'
              style={{ animationDelay: '180ms' }}
            >
              <CopyField
                label={t(HERO.baseUrlLabel)}
                value={props.baseUrl}
                endpoints={ENDPOINTS}
              />
            </div>

            <div
              className='landing-fade-up flex flex-wrap items-center gap-3'
              style={{ animationDelay: '240ms' }}
            >
              <Link
                to={props.primaryHref}
                className='flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-md transition-transform hover:scale-[1.03]'
                style={{ background: 'var(--primary)' }}
              >
                <IconPlay size={15} />
                {t(HERO.primaryCta)}
              </Link>
              <a
                href={props.docsUrl}
                target='_blank'
                rel='noreferrer'
                className='flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-transform hover:scale-[1.03]'
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--card)',
                  color: 'var(--text-1)',
                }}
              >
                <IconDoc size={15} />
                {t(HERO.secondaryCta)}
              </a>
              {HERO.tertiaryHref ? (
                <a
                  href={HERO.tertiaryHref}
                  target='_blank'
                  rel='noreferrer'
                  className='flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-transform hover:scale-[1.03]'
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                    color: 'var(--text-1)',
                  }}
                >
                  <IconExternal size={15} />
                  {t(HERO.tertiaryCta)}
                </a>
              ) : (
                <span
                  className='flex cursor-default items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium'
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                    color: 'var(--text-2)',
                  }}
                >
                  <IconExternal size={15} />
                  {t(HERO.tertiaryCta)}
                </span>
              )}
            </div>

            <div
              className='landing-fade-up flex flex-wrap gap-4 pt-1'
              style={{ animationDelay: '300ms' }}
            >
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className='flex flex-col gap-0.5 rounded-xl border border-dashed px-4 py-2.5 shadow-sm transition-transform duration-300 hover:scale-105'
                  style={{
                    borderColor:
                      'color-mix(in srgb, var(--primary) 28%, transparent)',
                    background:
                      'color-mix(in srgb, var(--primary) 6%, transparent)',
                  }}
                >
                  <span
                    className='stat-num text-2xl font-bold tracking-tight sm:text-3xl'
                    style={{ color: 'var(--text-0)' }}
                  >
                    {s.value}
                  </span>
                  <span
                    className='text-xs tracking-wide uppercase'
                    style={{ color: 'var(--text-2)' }}
                  >
                    {t(s.label)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 右列：三张能力卡片面板 */}
          <div
            className='landing-fade-up relative'
            style={{ animationDelay: '360ms' }}
          >
            <div className='relative mx-auto max-w-md'>
              <div
                className='absolute inset-0 rounded-[36px] opacity-50 blur-3xl'
                style={{
                  background:
                    'linear-gradient(135deg, var(--glow-1), var(--glow-2))',
                }}
              />
              <div
                className='relative flex flex-col gap-5 rounded-[28px] border p-6 shadow-xl backdrop-blur-xl'
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--card)',
                }}
              >
                {HERO_CARDS.map((c, i) => {
                  const Icon = ICONS[c.icon as IconKey]
                  return (
                    <div
                      key={c.title}
                      className='group card-float flex flex-col gap-2 rounded-2xl border px-5 py-4 shadow-sm transition-shadow duration-300 hover:shadow-lg'
                      style={{
                        borderColor: 'var(--border)',
                        background: 'var(--bg-1)',
                        animationDelay: `${i * 0.8}s`,
                      }}
                    >
                      <div className='flex items-center gap-3'>
                        <span
                          className='flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105'
                          style={{
                            background: 'rgba(99,102,241,0.14)',
                            color: 'var(--primary)',
                          }}
                        >
                          <Icon size={18} />
                        </span>
                        <span
                          className='text-sm font-semibold'
                          style={{ color: 'var(--text-0)' }}
                        >
                          {t(c.title)}
                        </span>
                      </div>
                      <span
                        className='text-xs leading-relaxed'
                        style={{ color: 'var(--text-2)' }}
                      >
                        {t(c.desc)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

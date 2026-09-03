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

import { CTA } from './data/content'
import { IconPlay, IconDoc, IconExternal } from './Icons'
import { Reveal } from './Reveal'

interface CtaProps {
  docsUrl: string
  primaryHref: '/dashboard' | '/sign-up' | '/sign-in'
}

export function Cta(props: CtaProps) {
  const { t } = useTranslation()

  return (
    <section
      className='flex flex-col justify-center'
      style={{ background: 'var(--bg-0)' }}
    >
      <div className='mx-auto flex w-full max-w-5xl flex-col px-5 py-12 md:px-6 lg:px-8'>
        <Reveal>
          {/* 卡片：overflow-hidden 把倾斜渐变层裁切在内部 */}
          <div
            className='relative overflow-hidden rounded-3xl border px-6 py-12 text-center md:px-12'
            style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
          >
            {/* 顶部柔光 */}
            <div
              aria-hidden
              className='pointer-events-none absolute inset-0 opacity-50'
              style={{
                background:
                  'radial-gradient(circle at center top, var(--glow-1), transparent 60%)',
              }}
            />
            {/* 倾斜渐变层（被卡片 overflow-hidden 裁切，进场旋转后归位到 8°） */}
            <div
              aria-hidden
              className='cta-tilt pointer-events-none absolute inset-0'
              style={{
                background:
                  'radial-gradient(circle at 20% -10%, var(--glow-2), transparent 55%)',
              }}
            />

            <div className='relative z-10 flex flex-col items-center gap-6'>
              <h2
                className='text-3xl font-semibold md:text-4xl'
                style={{ color: 'var(--text-0)' }}
              >
                {t(CTA.title)}
              </h2>
              <p
                className='max-w-2xl text-base leading-relaxed'
                style={{ color: 'var(--text-1)' }}
              >
                {t(CTA.subtitle)}
              </p>
              <div className='flex flex-wrap items-center justify-center gap-4'>
                <Link
                  to={props.primaryHref}
                  className='flex items-center gap-2 rounded-3xl px-8 py-3 font-medium text-white shadow-md transition-transform hover:scale-[1.03]'
                  style={{ background: 'var(--primary)' }}
                >
                  <IconPlay size={16} />
                  {t(CTA.primary)}
                </Link>
                <a
                  href={props.docsUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='flex items-center gap-2 rounded-3xl border px-6 py-3 font-medium transition-transform hover:scale-[1.03]'
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--bg-1)',
                    color: 'var(--text-1)',
                  }}
                >
                  <IconDoc size={16} />
                  {t(CTA.secondary)}
                </a>
                {CTA.tertiaryHref ? (
                  <a
                    href={CTA.tertiaryHref}
                    target='_blank'
                    rel='noreferrer'
                    className='flex items-center gap-2 rounded-3xl border px-6 py-3 font-medium transition-transform hover:scale-[1.03]'
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg-1)',
                      color: 'var(--text-1)',
                    }}
                  >
                    <IconExternal size={16} />
                    {t(CTA.tertiary)}
                  </a>
                ) : (
                  <span
                    className='flex cursor-default items-center gap-2 rounded-3xl border px-6 py-3 font-medium'
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--bg-1)',
                      color: 'var(--text-2)',
                    }}
                  >
                    <IconExternal size={16} />
                    {t(CTA.tertiary)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

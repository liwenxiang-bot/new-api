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

import { FEATURES } from './data/content'
import { ICONS, type IconKey } from './Icons'
import { Reveal } from './Reveal'

const TONE: Record<string, string> = {
  indigo: 'rgba(99,102,241,0.16)',
  sky: 'rgba(14,165,233,0.16)',
  teal: 'rgba(20,184,166,0.16)',
  violet: 'rgba(129,140,248,0.18)',
}

export function Features() {
  const { t } = useTranslation()

  return (
    <section
      className='flex flex-col justify-center'
      style={{ background: 'var(--bg-0)' }}
    >
      <div className='mx-auto flex w-full max-w-6xl flex-col px-5 py-20 md:px-6 lg:px-8'>
        <Reveal>
          <span
            className='text-sm tracking-widest uppercase'
            style={{ color: 'var(--text-2)' }}
          >
            {t(FEATURES.eyebrow)}
          </span>
          <h2
            className='mt-3 text-3xl font-semibold md:text-4xl'
            style={{ color: 'var(--text-0)' }}
          >
            {t(FEATURES.title)}
          </h2>
          <p
            className='mt-4 max-w-2xl text-base leading-relaxed'
            style={{ color: 'var(--text-1)' }}
          >
            {t(FEATURES.subtitle)}
          </p>
        </Reveal>

        <div className='mt-10 grid gap-6 md:grid-cols-2'>
          {FEATURES.items.map((f, i) => {
            const Icon = ICONS[f.icon as IconKey]
            return (
              <Reveal key={f.title} delay={i * 90}>
                <div
                  className='group flex h-full flex-col gap-5 rounded-2xl border p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1.5'
                  style={{
                    borderColor: 'var(--border)',
                    background: 'var(--card)',
                  }}
                >
                  <span
                    className='flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3'
                    style={{
                      background: TONE[f.tone],
                      color: 'var(--primary)',
                    }}
                  >
                    <Icon size={20} />
                  </span>
                  <h3
                    className='text-xl font-semibold'
                    style={{ color: 'var(--text-0)' }}
                  >
                    {t(f.title)}
                  </h3>
                  <p
                    className='text-sm leading-relaxed'
                    style={{ color: 'var(--text-1)' }}
                  >
                    {t(f.desc)}
                  </p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

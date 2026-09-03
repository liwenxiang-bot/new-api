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

import { ECOSYSTEM } from './data/content'
import { ProviderIcon } from './ProviderIcon'
import { Reveal } from './Reveal'

export function Ecosystem() {
  const { t } = useTranslation()

  return (
    <section
      className='flex flex-col justify-center'
      style={{ background: 'var(--bg-0)' }}
    >
      <div className='mx-auto flex w-full max-w-6xl flex-col px-5 py-20 md:px-6 lg:px-8'>
        <Reveal className='text-center'>
          <span
            className='text-sm tracking-widest uppercase'
            style={{ color: 'var(--text-2)' }}
          >
            {t(ECOSYSTEM.eyebrow)}
          </span>
          <h2
            className='mt-3 text-3xl font-semibold md:text-4xl'
            style={{ color: 'var(--text-0)' }}
          >
            {t(ECOSYSTEM.title)}
          </h2>
          <p
            className='mx-auto mt-4 max-w-xl text-base leading-relaxed'
            style={{ color: 'var(--text-1)' }}
          >
            {t(ECOSYSTEM.subtitle)}
          </p>
        </Reveal>

        <div className='mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6'>
          {ECOSYSTEM.providers.map((p, i) => (
            <Reveal key={p} delay={(i % 7) * 60}>
              <div
                aria-label={t(p)}
                className='flex h-16 w-28 items-center justify-center rounded-2xl border shadow-sm transition-transform duration-300 hover:-translate-y-2 hover:shadow-lg'
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--card)',
                }}
              >
                <ProviderIcon name={p} />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

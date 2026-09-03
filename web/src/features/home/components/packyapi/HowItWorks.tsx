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
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { STEPS } from './data/content'
import { ICONS, type IconKey } from './Icons'
import { Reveal } from './Reveal'

/**
 * 进场倾斜动画：卡片初始带倾斜(rot°)+横向偏移(tx)，
 * 进入视口后滑动归位到正位（复刻原站交替倾斜入场）。
 */
function TiltIn({
  children,
  rot,
  tx,
  delay = 0,
}: {
  children: ReactNode
  rot: number
  tx: number
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.25) setInView(true)
          else if (e.intersectionRatio === 0) setInView(false)
        })
      },
      { threshold: [0, 0.25] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        transform: inView
          ? 'rotate(0deg) translate(0,0)'
          : `rotate(${rot}deg) translate(${tx}px, 40px)`,
        opacity: inView ? 1 : 0,
        transition: `transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, opacity 0.6s ease ${delay}ms`,
        willChange: 'transform, opacity',
      }}
    >
      {children}
    </div>
  )
}

export function HowItWorks() {
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
            {t(STEPS.eyebrow)}
          </span>
          <h2
            className='mt-3 text-3xl font-semibold md:text-4xl'
            style={{ color: 'var(--text-0)' }}
          >
            {t(STEPS.title)}
          </h2>
        </Reveal>

        <div className='mt-10 grid gap-6 md:grid-cols-3'>
          {STEPS.items.map((s, i) => {
            const Icon = ICONS[s.icon as IconKey]
            // 交替倾斜进场：1→右倒(-6°) 2→左倒(+6°) 3→右倒(-6°)，归位到正
            const rot = i % 2 === 0 ? -6 : 6
            const tx = i % 2 === 0 ? -60 : 60
            return (
              <TiltIn key={s.no} rot={rot} tx={tx} delay={i * 120}>
                <div
                  className='step-card group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border p-6'
                  style={
                    {
                      borderColor: 'var(--border)',
                      background: 'var(--card)',
                      // hover 倾斜方向：1→右倒(-3°,右移) 2→左倒(+3°,左移) 3→右倒(-3°,右移)
                      '--hover-rot': `${i % 2 === 0 ? -3 : 3}deg`,
                      '--hover-tx': `${i % 2 === 0 ? 6 : -6}px`,
                    } as React.CSSProperties
                  }
                >
                  <span
                    aria-hidden
                    className='absolute inset-y-0 left-0 w-[3px]'
                    style={{
                      background:
                        'linear-gradient(to bottom, var(--primary), var(--accent), transparent)',
                      opacity: 0.5,
                    }}
                  />
                  <span
                    className='flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3'
                    style={{
                      background:
                        'color-mix(in srgb, var(--primary) 12%, transparent)',
                      color: 'var(--primary)',
                    }}
                  >
                    <Icon size={20} />
                  </span>
                  <div
                    className='text-xs font-semibold tracking-widest uppercase'
                    style={{ color: 'var(--text-2)' }}
                  >
                    {s.no}
                  </div>
                  <h3
                    className='text-lg font-semibold'
                    style={{ color: 'var(--text-0)' }}
                  >
                    {t(s.title)}
                  </h3>
                  <p
                    className='text-sm leading-relaxed'
                    style={{ color: 'var(--text-1)' }}
                  >
                    {t(s.desc)}
                  </p>
                </div>
              </TiltIn>
            )
          })}
        </div>
      </div>
    </section>
  )
}

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

type Props = {
  children: ReactNode
  /** 进场延迟（毫秒），用于 stagger */
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'span'
}

/**
 * 进入视口时触发淡入上移（复刻原版 landing-fade-up 时序）。
 * snap 翻页场景下：离开视口会重置，再次进入时重新播放进场动画——
 * 这样每屏切过来都有一次明确的入场动效。
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
  as = 'div',
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          // 进入视口（较高可见比例）→ 播放；完全离开 → 重置，便于下次再播
          if (e.isIntersecting && e.intersectionRatio >= 0.25) {
            setInView(true)
          } else if (e.intersectionRatio === 0) {
            setInView(false)
          }
        })
      },
      { threshold: [0, 0.25] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const Tag = as as 'div'
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={`reveal ${inView ? 'in-view' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  )
}

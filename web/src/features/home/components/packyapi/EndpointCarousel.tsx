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
import { useEffect, useState } from 'react'

type Props = {
  items: string[]
  intervalMs?: number
}

const ITEM_H = 22 // 每行高度(px)

/** URL 输入框右侧的接口路径：垂直 wheel 滚动切换（上下滚动，露出相邻项边缘） */
export function EndpointCarousel({ items, intervalMs = 2200 }: Props) {
  const [idx, setIdx] = useState(0)
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    if (items.length <= 1) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const timer = setInterval(() => {
      setIdx((i) => i + 1)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [items.length, intervalMs])

  // 滚到“克隆首项”时无缝跳回，制造无限循环
  useEffect(() => {
    if (idx === items.length) {
      const t = window.setTimeout(() => {
        setAnimate(false)
        setIdx(0)
        // 下一帧恢复动画
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setAnimate(true))
        )
      }, 450)
      return () => clearTimeout(t)
    }
  }, [idx, items.length])

  // 列表末尾追加首项克隆，保证从最后一项滚到第一项也是“向下滚”
  const list = [...items, items[0]]

  return (
    <div
      className='relative overflow-hidden text-xs md:text-sm'
      style={{ height: ITEM_H }}
      aria-hidden
    >
      <div
        style={{
          transform: `translateY(-${idx * ITEM_H}px)`,
          transition: animate
            ? 'transform 0.45s cubic-bezier(0.16,1,0.3,1)'
            : 'none',
        }}
      >
        {list.map((it, i) => (
          <div
            key={i === items.length ? `${it}-clone` : it}
            className='flex items-center justify-end font-bold whitespace-nowrap'
            style={{ height: ITEM_H, color: 'var(--primary)' }}
          >
            {it}
          </div>
        ))}
      </div>
    </div>
  )
}

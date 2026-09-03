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
// 自绘极简图标集（不使用任何第三方品牌素材）
type P = { className?: string; size?: number }

const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export function IconActivity({ className, size }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d='M3 12h4l3 8 4-16 3 8h4' />
    </svg>
  )
}

export function IconChart({ className, size }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d='M3 3v18h18' />
      <rect x='7' y='11' width='3' height='6' />
      <rect x='12' y='7' width='3' height='10' />
      <rect x='17' y='13' width='3' height='4' />
    </svg>
  )
}

export function IconCloud({ className, size }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d='M17.5 19a4.5 4.5 0 0 0 .5-8.98A6 6 0 0 0 6.3 9.5 4 4 0 0 0 7 17.5h10.5Z' />
    </svg>
  )
}

export function IconLayers({ className, size }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d='M12 3 3 8l9 5 9-5-9-5Z' />
      <path d='M3 13l9 5 9-5' />
      <path d='M3 18l9 5 9-5' />
    </svg>
  )
}

export function IconPlay({ className, size }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d='M6 4l13 8-13 8V4Z' fill='currentColor' stroke='none' />
    </svg>
  )
}

export function IconDoc({ className, size }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d='M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z' />
      <path d='M14 3v5h5M9 13h6M9 17h6' />
    </svg>
  )
}

export function IconExternal({ className, size }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d='M14 4h6v6M20 4l-9 9' />
      <path d='M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4' />
    </svg>
  )
}

export function IconCopy({ className, size }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x='9' y='9' width='11' height='11' rx='2' />
      <path d='M5 15V5a2 2 0 0 1 2-2h10' />
    </svg>
  )
}

export function IconArrow({ className, size }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d='M5 12h14M13 6l6 6-6 6' />
    </svg>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const ICONS = {
  activity: IconActivity,
  chart: IconChart,
  cloud: IconCloud,
  layers: IconLayers,
} as const

export type IconKey = keyof typeof ICONS

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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EndpointCarousel } from './EndpointCarousel'
import { IconCopy } from './Icons'

type Props = {
  label: string
  value: string
  endpoints: string[]
}

/** base URL 输入框 + 接口轮播 + 复制按钮（带“已复制”反馈） */
export function CopyField({ label, value, endpoints }: Props) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function copy() {
    const done = () => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1100)
    }
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value)
      } catch {
        legacyCopy(value)
      }
      done()
      return
    }
    legacyCopy(value)
    done()
  }

  return (
    <div
      className='packy-endpoint-card w-full max-w-xl rounded-2xl border p-3 shadow-lg backdrop-blur md:p-4'
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <span
        className='mb-2 block text-[11px] tracking-wide uppercase'
        style={{ color: 'var(--text-2)' }}
      >
        {label}
      </span>
      <div
        className='endpoint-input relative flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors'
        style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}
      >
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className='min-w-0 flex-1 truncate bg-transparent text-sm outline-none md:text-base'
          style={{ color: 'var(--text-0)' }}
          aria-label={t('Base URL')}
        />
        {/* 接口轮播：始终显示，窄屏自动收窄不溢出 */}
        <div className='min-w-0 shrink'>
          <EndpointCarousel items={endpoints} />
        </div>
        <button
          type='button'
          onClick={copy}
          aria-label={t('Copy')}
          className='ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors'
          style={{ color: 'var(--text-1)', background: 'var(--border)' }}
        >
          <IconCopy size={16} />
        </button>
        {copied && (
          <span
            className='absolute -top-9 right-0 rounded-md px-2.5 py-1 text-xs whitespace-nowrap shadow-lg'
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {t('Copied')}
          </span>
        )}
      </div>
    </div>
  )
}

function legacyCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    document.execCommand('copy')
  } catch {
    /* ignore */
  }
  document.body.removeChild(ta)
}

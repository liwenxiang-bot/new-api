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

// 厂商图标：使用 @lobehub/icons（MIT 许可，AI 厂商图标集）的 SVG，
// 已复制到 public/providers/。彩色版自带配色；单色版用主题文字色渲染。

// 厂商名 → public/providers/ 下的文件名（小写）
const FILE: Record<string, string> = {
  OpenAI: 'openai',
  Claude: 'claude',
  Gemini: 'gemini',
  Grok: 'grok',
  DeepSeek: 'deepseek',
  Qwen: 'qwen',
  Moonshot: 'moonshot',
  Zhipu: 'zhipu',
  Volcengine: 'volcengine',
  Cohere: 'cohere',
  Minimax: 'minimax',
  Wenxin: 'wenxin',
  Spark: 'spark',
  Hunyuan: 'hunyuan',
  Midjourney: 'midjourney',
  Suno: 'suno',
  Azure: 'azure',
  Qingyan: 'qingyan',
  Xinference: 'xinference',
}

// 单色 logo（无 -color 版）：用 CSS mask 上主题文字色，保证深浅色都可见
const MONO = new Set(['OpenAI', 'Grok', 'Moonshot', 'Suno', 'Midjourney'])

export function ProviderIcon({ name }: { name: string }) {
  const { t } = useTranslation()

  if (name === 'More') {
    return (
      <div
        className='flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold'
        style={{ color: 'var(--text-2)', border: '1px dashed var(--border)' }}
        title={t('More')}
      >
        30+
      </div>
    )
  }

  const file = FILE[name]
  if (!file) {
    return (
      <div
        className='flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold'
        style={{ color: 'var(--text-2)', background: 'var(--bg-1)' }}
        title={t(name)}
      >
        {name.slice(0, 2)}
      </div>
    )
  }

  const src = `${import.meta.env.BASE_URL}providers/${file}.svg`

  return (
    <div
      className='flex h-10 w-10 items-center justify-center rounded-xl'
      style={{ background: 'var(--bg-1)' }}
      title={t(name)}
    >
      {MONO.has(name) ? (
        // 单色图标：用 mask 染成主题文字色（深色背景显浅、浅色背景显深）
        <span
          aria-label={t(name)}
          role='img'
          style={{
            display: 'block',
            width: 22,
            height: 22,
            backgroundColor: 'var(--text-0)',
            WebkitMaskImage: `url(${src})`,
            maskImage: `url(${src})`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />
      ) : (
        <img src={src} alt={t(name)} width={22} height={22} loading='lazy' />
      )}
    </div>
  )
}

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
// 页面文案与数据。文案为通用产品宣传语，可按需修改。

export const HERO = {
  badge: 'AI Productivity Infrastructure for Enterprises',
  titleLine1: 'A Unified Gateway for AI Models',
  titleLine2: 'Connect to Global AI Capabilities',
  subtitle:
    'Connect global AI model resources with one domain, API key, and risk-control policy for observability, scalability, and control.',
  baseUrlLabel: 'Connect by Replacing the Base URL',
  baseUrl: 'https://api.9e.lv',
  primaryCta: 'Get API Key',
  secondaryCta: 'Docs',
  secondaryHref: 'https://docs.9e.lv/api-relay',
  tertiaryCta: 'Business Cooperation',
  tertiaryHref: '',
}

// URL 输入框右侧自动轮播的接口路径
export const ENDPOINTS = [
  '/v1/chat/completions',
  '/v1/responses',
  '/v1/messages',
  '/v1beta/models',
  '/v1/embeddings',
  '/v1/rerank',
  '/v1/images/generations',
  '/v1/images/edits',
  '/v1/images/variations',
  '/v1/audio/speech',
  '/v1/audio/transcriptions',
  '/v1/audio/translations',
]

export const STATS = [
  { value: '30+', label: 'Supported Models' },
  { value: '99.9%', label: 'SLA Availability' },
  { value: '7', label: 'Multi-Region Nodes' },
]

// hero 右侧三张能力卡片
export const HERO_CARDS = [
  {
    icon: 'activity',
    title: 'Real-Time Routing',
    desc: 'Switch dynamically based on health and latency weights to ensure the best response.',
  },
  {
    icon: 'chart',
    title: 'Unified Monitoring',
    desc: 'Visualize calls, costs, and errors in one place to keep track of operational status.',
  },
  {
    icon: 'cloud',
    title: 'Smart Rate Limiting',
    desc: 'Use multidimensional policies to prioritize core workloads and avoid traffic spikes.',
  },
]

export const FEATURES = {
  eyebrow: 'Core Values',
  title:
    'Give Teams Reliable Access to AI Models and Bring AI Innovation to Life Faster',
  subtitle:
    'From access control and cost visibility to global routing, Jiuyi API provides end-to-end AI infrastructure for enterprises.',
  items: [
    {
      icon: 'activity',
      title: 'One Entry Point, Fast Connections',
      desc: 'Connect all AI model providers with a single domain and API key, with intelligent failover to keep your business running.',
      tone: 'indigo',
    },
    {
      icon: 'chart',
      title: 'Full-Stack Observability and Risk Control',
      desc: 'Monitor calls, error rates, and costs in real time, and configure rate limits, alerts, and security policies in one click.',
      tone: 'sky',
    },
    {
      icon: 'cloud',
      title: 'On-Demand Scaling and Cost Optimization',
      desc: 'Control costs and concurrency with multi-channel quotas, intelligent routing, and batch task scheduling.',
      tone: 'teal',
    },
    {
      icon: 'layers',
      title: 'A Developer-Friendly Experience',
      desc: 'Compatible with the OpenAI API protocol, with SDKs, examples, and a Web Playground for easy iteration and deployment.',
      tone: 'violet',
    },
  ],
}

export const STEPS = {
  eyebrow: 'Workflow',
  title: 'Build Your AI Control Plane in 3 Steps',
  items: [
    {
      no: '01',
      icon: 'layers',
      title: 'Integration Setup',
      desc: 'Create channels, set API keys and limits, and import model lists in the console.',
    },
    {
      no: '02',
      icon: 'activity',
      title: 'Smart Routing',
      desc: 'Automatically choose the best model channel based on health, latency, and price, with built-in failover.',
    },
    {
      no: '03',
      icon: 'chart',
      title: 'Continuous Insights',
      desc: 'Track call trends, usage, and failure rates through the dashboard, with real-time alerts to ensure SLOs.',
    },
  ],
}

export const ECOSYSTEM = {
  eyebrow: 'Ecosystem Partners',
  title: 'Deep Integration with Leading Model Providers',
  subtitle:
    'Keep a unified protocol while switching and expanding model capabilities, with access to the latest ecosystem.',
  // 厂商名（图标在 ProviderIcon 中按 key 自绘/匹配）
  providers: [
    'OpenAI',
    'Claude',
    'Gemini',
    'Grok',
    'DeepSeek',
    'Qwen',
    'Moonshot',
    'Zhipu',
    'Volcengine',
    'Cohere',
    'Minimax',
    'Wenxin',
    'Spark',
    'Hunyuan',
    'Midjourney',
    'Suno',
    'Azure',
    'Qingyan',
    'Xinference',
    'More',
  ],
}

export const CTA = {
  title: 'Bring AI Model Capabilities into Your Business Workflows',
  subtitle:
    'Connect to Jiuyi API now to manage access policies and API costs in one place, bringing a stable, scalable AI experience to your products.',
  primary: 'Start Now',
  secondary: 'View Docs',
  secondaryHref: 'https://docs.9e.lv/api-relay',
  tertiary: 'Business Cooperation',
  tertiaryHref: '',
}

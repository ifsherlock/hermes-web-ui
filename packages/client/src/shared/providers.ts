/**
 * Provider registry — single source of truth for both frontend and backend.
 * Synced from hermes-agent hermes_cli/models.py _PROVIDER_MODELS.
 */

export interface ProviderPreset {
  label: string
  value: string
  base_url: string
  models: string[]
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: 'Anthropic',
    value: 'anthropic',
    base_url: 'https://api.anthropic.com',
    models: [
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-opus-4-5-20251101',
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
    ],
  },
  {
    label: 'Google AI Studio',
    value: 'gemini',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      'gemini-3.1-pro-preview',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemma-4-31b-it',
      'gemma-4-26b-it',
    ],
  },
  {
    label: 'DeepSeek',
    value: 'deepseek',
    base_url: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    label: 'Z.AI / GLM',
    value: 'zai',
    base_url: 'https://api.z.ai/api/paas/v4',
    models: ['glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.5', 'glm-4.5-flash'],
  },
  {
    label: 'Kimi for Coding',
    value: 'kimi-for-coding',
    base_url: 'https://api.kimi.com/coding/v1',
    models: [
      'kimi-for-coding',
      'kimi-k2.5',
      'kimi-k2-thinking',
      'kimi-k2-thinking-turbo',
      'kimi-k2-turbo-preview',
      'kimi-k2-0905-preview',
    ],
  },
  {
    label: 'xAI',
    value: 'xai',
    base_url: 'https://api.x.ai/v1',
    models: [
      'grok-4.20-0309-reasoning',
      'grok-4.20-0309-non-reasoning',
      'grok-4-1-fast-reasoning',
      'grok-4-1-fast-non-reasoning',
      'grok-4-fast-reasoning',
      'grok-4-fast-non-reasoning',
      'grok-4-0709',
      'grok-code-fast-1',
      'grok-3',
      'grok-3-mini',
    ],
  },
  {
    label: 'MiniMax',
    value: 'minimax',
    base_url: 'https://api.minimax.io/anthropic/v1',
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1', 'MiniMax-M2.1-highspeed', 'MiniMax-M2', 'MiniMax-M2-highspeed'],
  },
  {
    label: 'MiniMax (China)',
    value: 'minimax-cn',
    base_url: 'https://api.minimaxi.com/v1',
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1', 'MiniMax-M2.1-highspeed', 'MiniMax-M2', 'MiniMax-M2-highspeed'],
  },
  {
    label: 'Alibaba Cloud',
    value: 'alibaba',
    base_url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    models: [
      'qwen3.5-plus',
      'qwen3-coder-plus',
      'qwen3-coder-next',
      'glm-5',
      'glm-4.7',
      'kimi-k2.5',
      'MiniMax-M2.5',
    ],
  },
  {
    label: 'Hugging Face',
    value: 'huggingface',
    base_url: 'https://router.huggingface.co/v1',
    models: [
      'Qwen/Qwen3.5-397B-A17B',
      'Qwen/Qwen3.5-35B-A3B',
      'deepseek-ai/DeepSeek-V3.2',
      'moonshotai/Kimi-K2.5',
      'MiniMaxAI/MiniMax-M2.5',
      'zai-org/GLM-5',
      'XiaomiMiMo/MiMo-V2-Flash',
      'moonshotai/Kimi-K2-Thinking',
    ],
  },
  {
    label: 'Xiaomi MiMo',
    value: 'xiaomi',
    base_url: 'https://api.xiaomimimo.com/v1',
    models: ['mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-flash'],
  },
  {
    label: 'Kilo Code',
    value: 'kilo',
    base_url: 'https://api.kilo.ai/api/gateway',
    models: [
      'anthropic/claude-opus-4.6',
      'anthropic/claude-sonnet-4.6',
      'openai/gpt-5.4',
      'google/gemini-3-pro-preview',
      'google/gemini-3-flash-preview',
    ],
  },
  {
    label: 'Vercel AI Gateway',
    value: 'vercel',
    base_url: 'https://ai-gateway.vercel.sh/v1',
    models: [
      'anthropic/claude-opus-4.6',
      'anthropic/claude-sonnet-4.6',
      'anthropic/claude-sonnet-4.5',
      'anthropic/claude-haiku-4.5',
      'openai/gpt-5',
      'openai/gpt-4.1',
      'openai/gpt-4.1-mini',
      'google/gemini-3-pro-preview',
      'google/gemini-3-flash',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-v3.2',
    ],
  },
  {
    label: 'OpenCode Zen',
    value: 'opencode',
    base_url: 'https://opencode.ai/zen/v1',
    models: [
      'gpt-5.4-pro',
      'gpt-5.4',
      'gpt-5.3-codex',
      'gpt-5.2',
      'gpt-5.1',
      'claude-opus-4-6',
      'claude-sonnet-4-6',
      'claude-haiku-4-5',
      'gemini-3.1-pro',
      'gemini-3-pro',
      'gemini-3-flash',
      'minimax-m2.7',
      'minimax-m2.5',
      'glm-5',
      'glm-4.7',
      'kimi-k2.5',
    ],
  },
  {
    label: 'OpenCode Go',
    value: 'opencode-go',
    base_url: 'https://opencode.ai/zen/go/v1',
    models: ['glm-5', 'kimi-k2.5', 'mimo-v2-pro', 'mimo-v2-omni', 'minimax-m2.7', 'minimax-m2.5'],
  },
  {
    label: 'OpenRouter',
    value: 'openrouter',
    base_url: 'https://openrouter.ai/api/v1',
    models: [],
  },
]

/** Build a Record<providerKey, models[]> for backend lookup */
export function buildProviderModelMap(): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const p of PROVIDER_PRESETS) {
    if (p.models.length > 0) {
      map[p.value] = p.models
    }
  }
  return map
}

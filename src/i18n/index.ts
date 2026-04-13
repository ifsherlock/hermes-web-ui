import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zh from './locales/zh'

const saved = localStorage.getItem('hermes_locale')
const detected = navigator.language.slice(0, 2)

export const i18n = createI18n({
  legacy: false,
  locale: saved || (detected === 'zh' ? 'zh' : 'en'),
  fallbackLocale: 'en',
  messages: { en, zh },
})

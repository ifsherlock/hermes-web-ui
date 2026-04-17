import { createI18n } from 'vue-i18n'
import en from './locales/en'
import zh from './locales/zh'
import ja from './locales/ja'
import ko from './locales/ko'
import fr from './locales/fr'
import es from './locales/es'
import de from './locales/de'
import pt from './locales/pt'

const saved = localStorage.getItem('hermes_locale')
const detected = navigator.language.slice(0, 2)

const supportedLocales = ['en', 'zh', 'ja', 'ko', 'fr', 'es', 'de', 'pt'] as const
type SupportedLocale = (typeof supportedLocales)[number]

function resolveLocale(saved: string | null, detected: string): SupportedLocale {
  if (saved && (supportedLocales as readonly string[]).includes(saved)) {
    return saved as SupportedLocale
  }
  if ((supportedLocales as readonly string[]).includes(detected)) {
    return detected as SupportedLocale
  }
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: resolveLocale(saved, detected),
  fallbackLocale: 'en',
  messages: { en, zh, ja, ko, fr, es, de, pt },
})

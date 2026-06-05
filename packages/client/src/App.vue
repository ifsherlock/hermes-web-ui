<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { darkTheme, NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { getThemeOverrides } from '@/styles/theme'
import { useTheme } from '@/composables/useTheme'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useKeyboard } from '@/composables/useKeyboard'
import { useAppStore } from '@/stores/hermes/app'
import SessionSearchModal from '@/components/hermes/chat/SessionSearchModal.vue'
import AuthEventListener from '@/components/auth/AuthEventListener.vue'
import DefaultCredentialPrompt from '@/components/auth/DefaultCredentialPrompt.vue'

const { isDark, isComic, isPerson5 } = useTheme()
const { t } = useI18n()
const appStore = useAppStore()
const route = useRoute()
const router = useRouter()
const ready = ref(false)

const themeOverrides = computed(() => getThemeOverrides(isDark.value, isComic.value))
const naiveTheme = computed(() => isDark.value ? darkTheme : null)

const isLoginPage = computed(() => route.name === 'login')

const nodeVersionLow = computed(() => {
  const v = appStore.nodeVersion
  const major = parseInt(v.split('.')[0], 10)
  return !isNaN(major) && major < 23
})

const p5Now = ref(new Date())
const p5Weather = ref({
  label: '明天',
  condition: '多云',
  icon: '☁',
})

const p5DateText = computed(() =>
  p5Now.value.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
)

const p5WeekdayText = computed(() =>
  p5Now.value.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase(),
)

const p5BrandChars = computed(() => Array.from('卢布朗咖啡店'))

const weatherCodeMap: Array<{ codes: number[]; condition: string; icon: string }> = [
  { codes: [0], condition: '晴', icon: '☀' },
  { codes: [1, 2], condition: '多云', icon: '☁' },
  { codes: [3], condition: '阴', icon: '☁' },
  { codes: [45, 48], condition: '雾', icon: '≋' },
  { codes: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], condition: '雨', icon: '☂' },
  { codes: [71, 73, 75, 77, 85, 86], condition: '雪', icon: '❄' },
  { codes: [95, 96, 99], condition: '雷', icon: '⚡' },
]

function mapWeatherCode(code: number | undefined) {
  return weatherCodeMap.find((entry) => entry.codes.includes(Number(code))) || weatherCodeMap[1]
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: 1000 * 60 * 30,
      timeout: 3000,
    })
  })
}

async function loadPerson5Weather() {
  try {
    const fallback = { latitude: 31.2304, longitude: 121.4737 }
    let coords = fallback
    try {
      const position = await getCurrentPosition()
      coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }
    } catch {
      coords = fallback
    }

    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      current: 'weather_code,temperature_2m',
      daily: 'weather_code',
      timezone: 'auto',
      forecast_days: '2',
    })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
    if (!res.ok) throw new Error(`Weather request failed: ${res.status}`)
    const data = await res.json()
    const code = data?.daily?.weather_code?.[1] ?? data?.current?.weather_code
    const mapped = mapWeatherCode(code)
    p5Weather.value = {
      label: '明天',
      condition: mapped.condition,
      icon: mapped.icon,
    }
  } catch {
    p5Weather.value = {
      label: '明天',
      condition: '多云',
      icon: '☁',
    }
  }
}

// Close mobile sidebar on route change
watch(() => route.path, () => {
  appStore.closeSidebar()
})

// Wait for router to resolve before rendering layout
router.isReady().then(() => {
  ready.value = true
})

onMounted(() => {
  if (!isLoginPage.value) {
    appStore.loadModels()
    appStore.startHealthPolling()
  }
  if (isPerson5.value) {
    void loadPerson5Weather()
  }
})

onUnmounted(() => {
  appStore.stopHealthPolling()
})

useKeyboard()

watch(isPerson5, (active) => {
  if (active) void loadPerson5Weather()
})
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <NMessageProvider>
      <AuthEventListener />
      <NDialogProvider>
        <NNotificationProvider>
          <div v-if="nodeVersionLow && ready" class="node-warning-bar">
            {{ t('sidebar.nodeVersionWarning', { version: appStore.nodeVersion }) }}
          </div>
          <div v-if="ready && !isLoginPage && isPerson5" class="p5-command-bar">
            <div class="p5-brand" aria-label="卢布朗咖啡店 CAFÉ LEBLANC">
              <span class="p5-brand-kanji" aria-hidden="true">
                <span
                  v-for="(char, index) in p5BrandChars"
                  :key="`${char}-${index}`"
                  class="p5-brand-char"
                >
                  {{ char }}
                </span>
              </span>
              <span class="p5-brand-latin">CAFÉ LEBLANC</span>
              <span class="p5-sr-text">卢布朗咖啡店</span>
              <span class="p5-sr-text">CAFÉ LEBLANC</span>
            </div>
            <div class="p5-date-card" aria-label="日期与天气">
              <strong class="p5-date-main">{{ p5DateText }}</strong>
              <span class="p5-weekday">{{ p5WeekdayText }}</span>
              <span class="p5-day-slot" aria-hidden="true"></span>
              <span class="p5-daytime">1 白天</span>
              <span class="p5-weather-icon" aria-hidden="true">{{ p5Weather.icon }}</span>
              <span class="p5-weather">
                <span class="p5-weather-condition">{{ p5Weather.condition }}</span>
                {{ ' ' }}
                <span class="p5-weather-label">{{ p5Weather.label }}</span>
              </span>
            </div>
            <div class="p5-status-card">
              <span :class="['p5-live-dot', { online: appStore.connected }]"></span>
              <span>{{ appStore.connected ? t('sidebar.connected') : t('sidebar.disconnected') }}</span>
            </div>
          </div>
          <div v-if="ready" class="app-layout" :class="{ 'no-sidebar': isLoginPage }">
            <button v-if="!isLoginPage" class="hamburger-btn" @click="appStore.toggleSidebar">
              <img src="/logo.png" alt="Menu" style="width: 24px; height: 24px;" />
            </button>
            <div v-if="!isLoginPage && appStore.sidebarOpen" class="mobile-backdrop" @click="appStore.closeSidebar" />
            <AppSidebar v-if="!isLoginPage" />
            <main class="app-main">
              <router-view />
            </main>
          </div>
          <SessionSearchModal />
          <DefaultCredentialPrompt />
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.app-layout {
  display: flex;
  height: calc(100 * var(--vh));
  width: 100%;
  max-width: 100%;
  overflow: hidden;

  &.no-sidebar {
    display: block;
  }
}

.app-main {
  flex: 1;
  overflow-y: auto;
  background-color: $bg-primary;

  .no-sidebar & {
    height: calc(100 * var(--vh));
  }
}

.node-warning-bar {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  padding: 4px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #b45309;
  background-color: #fef3c7;
  border-bottom: 1px solid #fde68a;
  text-align: center;
  line-height: 1.4;
}
</style>

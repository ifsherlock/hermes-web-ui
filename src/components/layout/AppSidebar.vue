<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/stores/app'
import ModelSelector from './ModelSelector.vue'
import LanguageSwitch from './LanguageSwitch.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const selectedKey = computed(() => route.name as string)

function handleNav(key: string) {
  router.push({ name: key })
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-logo" @click="router.push('/')">
      <img src="/assets/logo.png" alt="Hermes" class="logo-img" />
      <span class="logo-text">Hermes</span>
    </div>

    <nav class="sidebar-nav">
      <button
        class="nav-item"
        :class="{ active: selectedKey === 'chat' }"
        @click="handleNav('chat')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>{{ t('sidebar.chat') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'jobs' }"
        @click="handleNav('jobs')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{{ t('sidebar.jobs') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'models' }"
        @click="handleNav('models')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4" /><path d="M12 19v4" />
          <path d="M1 12h4" /><path d="M19 12h4" />
          <path d="M4.22 4.22l2.83 2.83" /><path d="M16.95 16.95l2.83 2.83" />
          <path d="M4.22 19.78l2.83-2.83" /><path d="M16.95 7.05l2.83-2.83" />
        </svg>
        <span>{{ t('sidebar.models') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'channels' }"
        @click="handleNav('channels')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <span>{{ t('sidebar.channels') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'skills' }"
        @click="handleNav('skills')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span>{{ t('sidebar.skills') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'memory' }"
        @click="handleNav('memory')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
        <span>{{ t('sidebar.memory') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'logs' }"
        @click="handleNav('logs')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>{{ t('sidebar.logs') }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'settings' }"
        @click="handleNav('settings')"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>{{ t('sidebar.settings') }}</span>
      </button>
    </nav>

    <ModelSelector />

    <div class="sidebar-footer">
      <div class="status-row">
        <div class="status-indicator" :class="{ connected: appStore.connected, disconnected: !appStore.connected }">
          <span class="status-dot"></span>
          <span class="status-text">{{ appStore.connected ? t('sidebar.connected') : t('sidebar.disconnected') }}</span>
        </div>
        <LanguageSwitch />
      </div>
      <div class="version-info">Hermes {{ appStore.serverVersion || 'v0.1.0' }}</div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.sidebar {
  width: $sidebar-width;
  height: 100vh;
  background-color: $bg-sidebar;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  flex-shrink: 0;
  transition: width $transition-normal;
}

.logo-img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 12px 20px;
  color: $text-primary;
  cursor: pointer;

  .logo-text {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: none;
  color: $text-secondary;
  font-size: 14px;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $transition-fast;
  width: 100%;
  text-align: left;

  &:hover {
    background-color: rgba($accent-primary, 0.06);
    color: $text-primary;
  }

  &.active {
    background-color: rgba($accent-primary, 0.12);
    color: $accent-primary;
  }
}

.sidebar-footer {
  padding-top: 16px;
  border-top: 1px solid $border-color;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &.connected .status-dot {
    background-color: $success;
    box-shadow: 0 0 6px rgba($success, 0.5);
  }

  &.disconnected .status-dot {
    background-color: $error;
  }

  .status-text {
    color: $text-secondary;
  }
}

.version-info {
  padding: 2px 12px 8px;
  font-size: 11px;
  color: $text-muted;
}

</style>

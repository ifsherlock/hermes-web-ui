<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider } from 'naive-ui'
import { themeOverrides } from '@/styles/theme'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useKeyboard } from '@/composables/useKeyboard'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const route = useRoute()
const router = useRouter()
const ready = ref(false)

const isLoginPage = computed(() => route.name === 'login')

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
})

onUnmounted(() => {
  appStore.stopHealthPolling()
})

useKeyboard()
</script>

<template>
  <NConfigProvider :theme-overrides="themeOverrides">
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <div v-if="ready" class="app-layout" :class="{ 'no-sidebar': isLoginPage }">
            <button v-if="!isLoginPage" class="hamburger-btn" @click="appStore.toggleSidebar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div v-if="!isLoginPage && appStore.sidebarOpen" class="mobile-backdrop" @click="appStore.closeSidebar" />
            <AppSidebar v-if="!isLoginPage" />
            <main class="app-main">
              <router-view />
            </main>
          </div>
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
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
    height: 100vh;
  }
}
</style>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { NConfigProvider, NMessageProvider, NDialogProvider, NNotificationProvider } from 'naive-ui'
import { themeOverrides } from '@/styles/theme'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useKeyboard } from '@/composables/useKeyboard'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

onMounted(() => {
  appStore.loadModels()
  appStore.startHealthPolling()
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
          <div class="app-layout">
            <AppSidebar />
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
}

.app-main {
  flex: 1;
  overflow-y: auto;
  background-color: $bg-primary;
}
</style>

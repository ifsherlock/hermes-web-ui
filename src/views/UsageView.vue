<script setup lang="ts">
import { NButton } from 'naive-ui'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUsageStore } from '@/stores/usage'
import StatCards from '@/components/usage/StatCards.vue'
import ModelBreakdown from '@/components/usage/ModelBreakdown.vue'
import DailyTrend from '@/components/usage/DailyTrend.vue'

const { t } = useI18n()
const usageStore = useUsageStore()

onMounted(() => {
  usageStore.loadSessions()
})
</script>

<template>
  <div class="usage-view">
    <header class="usage-header">
      <h2 class="usage-title">{{ t('usage.title') }}</h2>
      <NButton size="small" quaternary :loading="usageStore.isLoading" @click="usageStore.loadSessions()">
        {{ t('usage.refresh') }}
      </NButton>
    </header>

    <div v-if="usageStore.isLoading && usageStore.sessions.length === 0" class="usage-loading">
      {{ t('common.loading') }}
    </div>

    <template v-else-if="usageStore.sessions.length > 0">
      <StatCards />
      <ModelBreakdown />
      <DailyTrend />
    </template>

    <div v-else class="usage-empty">
      {{ t('usage.noData') }}
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.usage-view {
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
}

.usage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.usage-title {
  font-size: 18px;
  font-weight: 600;
  color: $text-primary;
  margin: 0;
}

.usage-loading,
.usage-empty {
  text-align: center;
  padding: 60px 0;
  color: $text-muted;
  font-size: 14px;
}
</style>

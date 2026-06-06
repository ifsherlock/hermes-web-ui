<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GithubPreviewSettings from '@/components/hermes/settings/GithubPreviewSettings.vue'

const { t } = useI18n()
</script>

<template>
  <div class="version-preview-view">
    <header class="page-header">
      <h2 class="header-title">{{ t('githubPreview.title') }}</h2>
    </header>

    <div class="page-content">
      <GithubPreviewSettings />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.version-preview-view {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 20px;
  padding-bottom: 56px;
  box-sizing: border-box;
}
</style>

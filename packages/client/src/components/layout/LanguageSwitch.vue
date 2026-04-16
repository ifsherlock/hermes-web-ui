<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { NSelect } from 'naive-ui'

const { locale, availableLocales, t } = useI18n()

const options = computed(() =>
  availableLocales.map(loc => ({
    label: loc === 'zh' ? t('language.zh') : t('language.en'),
    value: loc,
  })),
)

function handleChange(val: string) {
  locale.value = val
  localStorage.setItem('hermes_locale', val)
}
</script>

<template>
  <NSelect
    :value="locale"
    :options="options"
    size="tiny"
    :consistent-menu-width="false"
    class="input-sm"
    @update:value="handleChange"
  />
</template>

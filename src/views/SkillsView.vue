<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import SkillList from '@/components/skills/SkillList.vue'
import SkillDetail from '@/components/skills/SkillDetail.vue'
import { fetchSkills, type SkillCategory } from '@/api/skills'

const { t } = useI18n()
const categories = ref<SkillCategory[]>([])
const loading = ref(false)
const selectedCategory = ref('')
const selectedSkill = ref('')
const searchQuery = ref('')

onMounted(loadSkills)

async function loadSkills() {
  loading.value = true
  try {
    categories.value = await fetchSkills()
  } catch (err: any) {
    console.error('Failed to load skills:', err)
  } finally {
    loading.value = false
  }
}

function handleSelect(category: string, skill: string) {
  selectedCategory.value = category
  selectedSkill.value = skill
}
</script>

<template>
  <div class="skills-view">
    <header class="page-header">
      <h2 class="header-title">{{ t('skills.title') }}</h2>
      <NInput
        v-model:value="searchQuery"
        :placeholder="t('skills.searchPlaceholder')"
        size="small"
        clearable
        class="search-input"
      />
    </header>

    <div class="skills-content">
      <div v-if="loading && categories.length === 0" class="skills-loading">Loading...</div>
      <div v-else class="skills-layout">
          <div class="skills-sidebar">
            <SkillList
              :categories="categories"
              :selected-skill="selectedCategory && selectedSkill ? `${selectedCategory}/${selectedSkill}` : null"
              :search-query="searchQuery"
              @select="handleSelect"
            />
          </div>
          <div class="skills-main">
            <SkillDetail
              v-if="selectedCategory && selectedSkill"
              :category="selectedCategory"
              :skill="selectedSkill"
            />
            <div v-else class="empty-detail">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>Select a skill from the list</span>
            </div>
          </div>
        </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.skills-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.search-input {
  width: 220px;
}

.skills-content {
  flex: 1;
  overflow: hidden;
}

.skills-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 13px;
  color: $text-muted;
}

.skills-layout {
  display: flex;
  height: 100%;
}

.skills-sidebar {
  width: 280px;
  border-right: 1px solid $border-color;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.skills-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  min-width: 0;
  min-height: 0;
}

.empty-detail {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: $text-muted;
  font-size: 13px;
}
</style>

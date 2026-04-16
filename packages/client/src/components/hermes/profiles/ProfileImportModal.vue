<script setup lang="ts">
import { ref } from 'vue'
import { NModal, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import { useProfilesStore } from '@/stores/hermes/profiles'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()
const profilesStore = useProfilesStore()
const message = useMessage()

const showModal = ref(true)
const loading = ref(false)
const archive = ref('')
const name = ref('')

async function handleSave() {
  if (!archive.value.trim()) {
    message.warning(t('profiles.archivePathPlaceholder'))
    return
  }

  loading.value = true
  try {
    const ok = await profilesStore.importProfile(
      archive.value.trim(),
      name.value.trim() || undefined,
    )
    if (ok) {
      message.success(t('profiles.importSuccess'))
      emit('saved')
    } else {
      message.error(t('profiles.importFailed'))
    }
  } finally {
    loading.value = false
  }
}

function handleClose() {
  showModal.value = false
  setTimeout(() => emit('close'), 200)
}
</script>

<template>
  <NModal
    v-model:show="showModal"
    preset="card"
    :title="t('profiles.import')"
    :style="{ width: 'min(420px, calc(100vw - 32px))' }"
    :mask-closable="!loading"
    @after-leave="emit('close')"
  >
    <NForm label-placement="top">
      <NFormItem :label="t('profiles.archivePath')" required>
        <NInput
          v-model:value="archive"
          :placeholder="t('profiles.archivePathPlaceholder')"
        />
      </NFormItem>

      <NFormItem :label="t('profiles.importName')">
        <NInput
          v-model:value="name"
          :placeholder="t('profiles.importNamePlaceholder')"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="modal-footer">
        <NButton @click="handleClose">{{ t('common.cancel') }}</NButton>
        <NButton type="primary" :loading="loading" @click="handleSave">
          {{ t('common.confirm') }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped lang="scss">
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

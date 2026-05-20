<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NButton, NModal, NSpin, useMessage } from 'naive-ui'
import multiavatar from '@multiavatar/multiavatar'
import { useProfilesStore } from '@/stores/hermes/profiles'
import {
  fetchProfileRuntimeStatuses,
  restartProfileGateway,
  restartProfileRuntime,
  type ProfileRuntimeStatus,
} from '@/api/hermes/profiles'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const message = useMessage()
const profilesStore = useProfilesStore()

const activeName = computed(() => profilesStore.activeProfileName ?? '')
const displayName = computed(() => activeName.value || 'default')
const avatarSvg = computed(() => multiavatar(displayName.value))
const runtimeStatuses = ref<ProfileRuntimeStatus[]>([])
const runtimeLoading = ref(false)
const showProfileModal = ref(false)
const gatewayRestarting = ref<Record<string, boolean>>({})
const profileRestarting = ref<Record<string, boolean>>({})
const profileSwitching = ref<Record<string, boolean>>({})
const statusByProfile = computed(() => new Map(runtimeStatuses.value.map(status => [status.profile, status])))

function avatarFor(name: string) {
  return multiavatar(name || 'default')
}

async function loadRuntimeStatuses() {
  runtimeLoading.value = true
  try {
    runtimeStatuses.value = await fetchProfileRuntimeStatuses()
  } catch {
    runtimeStatuses.value = []
  } finally {
    runtimeLoading.value = false
  }
}

function openProfileModal() {
  showProfileModal.value = true
  void loadRuntimeStatuses()
}

function gatewayStatusText(running?: boolean) {
  return running ? t('profiles.runtime.running') : t('profiles.runtime.stopped')
}

function bridgeStatusText(running?: boolean) {
  return running ? t('profiles.runtime.active') : t('profiles.runtime.idle')
}

async function handleRestartGateway(name: string) {
  gatewayRestarting.value = { ...gatewayRestarting.value, [name]: true }
  try {
    const gateway = await restartProfileGateway(name)
    const current = statusByProfile.value.get(name)
    if (current) {
      runtimeStatuses.value = runtimeStatuses.value.map(status => (
        status.profile === name ? { ...status, gateway } : status
      ))
    }
    message.success(t('profiles.runtime.gatewayRestarted', { name }))
  } catch (err: any) {
    message.error(err?.message || t('profiles.runtime.gatewayRestartFailed'))
  } finally {
    gatewayRestarting.value = { ...gatewayRestarting.value, [name]: false }
  }
}

async function handleRestartProfile(name: string) {
  profileRestarting.value = { ...profileRestarting.value, [name]: true }
  try {
    const status = await restartProfileRuntime(name)
    runtimeStatuses.value = runtimeStatuses.value.map(item => (
      item.profile === name ? status : item
    ))
    message.success(t('profiles.runtime.profileRestarted', { name }))
  } catch (err: any) {
    message.error(err?.message || t('profiles.runtime.profileRestartFailed'))
  } finally {
    profileRestarting.value = { ...profileRestarting.value, [name]: false }
  }
}

async function handleSwitchProfile(name: string) {
  if (name === displayName.value) return
  profileSwitching.value = { ...profileSwitching.value, [name]: true }
  try {
    const ok = await profilesStore.switchProfile(name)
    if (!ok) throw new Error(t('profiles.switchFailed'))
    message.success(t('profiles.switchSuccess', { name }))
    window.location.reload()
  } catch (err: any) {
    message.error(err?.message || t('profiles.switchFailed'))
  } finally {
    profileSwitching.value = { ...profileSwitching.value, [name]: false }
  }
}

onMounted(() => {
  if (profilesStore.profiles.length === 0) {
    profilesStore.fetchProfiles()
  }
})
</script>

<template>
  <div class="profile-selector">
    <div class="selector-label">{{ t('sidebar.profiles') }}</div>
    <div class="profile-display" data-testid="profile-selector-select" @click="openProfileModal">
      <span class="profile-avatar" v-html="avatarSvg" />
      <span class="profile-name">{{ displayName }}</span>
    </div>

    <NModal
      v-model:show="showProfileModal"
      preset="card"
      :bordered="false"
      :style="{ width: '720px', maxWidth: 'calc(100vw - 32px)' }"
      class="profile-manager-modal"
    >
      <template #header>
        <div class="profile-modal-header">
          <div class="profile-popover-title">
            <span class="profile-popover-name">{{ t('sidebar.profiles') }}</span>
            <span class="profile-popover-subtitle">{{ t('profiles.runtime.activeProfile', { name: displayName }) }}</span>
          </div>
        </div>
      </template>

      <NSpin :show="runtimeLoading" size="small">
        <div class="profile-runtime-list">
          <div
            v-for="profile in profilesStore.profiles"
            :key="profile.name"
            class="profile-runtime-item"
            :class="{ active: profile.name === displayName }"
          >
            <div class="profile-runtime-main">
              <span class="profile-runtime-avatar" v-html="avatarFor(profile.name)" />
              <div class="profile-runtime-info">
                <div class="profile-runtime-name-row">
                  <span class="profile-runtime-name">{{ profile.name }}</span>
                  <span v-if="profile.name === displayName" class="active-badge">{{ t('profiles.runtime.activeTag') }}</span>
                </div>
                <div class="runtime-status-grid">
                  <div class="runtime-row compact">
                    <span class="runtime-label">{{ t('profiles.runtime.bridgeWorker') }}</span>
                    <span class="runtime-value" :class="{ running: statusByProfile.get(profile.name)?.bridge.running }">
                      <span class="runtime-dot" />
                      {{ bridgeStatusText(statusByProfile.get(profile.name)?.bridge.running) }}
                    </span>
                  </div>
                  <div class="runtime-row compact">
                    <span class="runtime-label">{{ t('profiles.runtime.gateway') }}</span>
                    <span class="runtime-value" :class="{ running: statusByProfile.get(profile.name)?.gateway.running }">
                      <span class="runtime-dot" />
                      {{ gatewayStatusText(statusByProfile.get(profile.name)?.gateway.running) }}
                    </span>
                  </div>
                </div>
                <div
                  v-if="!statusByProfile.get(profile.name)?.gateway.running && (statusByProfile.get(profile.name)?.gateway.diagnostics?.reason || statusByProfile.get(profile.name)?.gateway.error)"
                  class="runtime-detail"
                >
                  {{ statusByProfile.get(profile.name)?.gateway.diagnostics?.reason || statusByProfile.get(profile.name)?.gateway.error }}
                </div>
              </div>
            </div>
            <div class="profile-runtime-actions">
              <NButton
                size="small"
                type="primary"
                :loading="gatewayRestarting[profile.name]"
                @click="handleRestartGateway(profile.name)"
              >
                {{ t('profiles.runtime.restartGateway') }}
              </NButton>
              <NButton
                size="small"
                type="primary"
                :loading="profileRestarting[profile.name]"
                @click="handleRestartProfile(profile.name)"
              >
                {{ t('profiles.runtime.restartProfile') }}
              </NButton>
              <NButton
                size="small"
                type="primary"
                :disabled="profile.name === displayName"
                :loading="profileSwitching[profile.name]"
                @click="handleSwitchProfile(profile.name)"
              >
                {{ t('profiles.runtime.switchProfile') }}
              </NButton>
            </div>
          </div>
        </div>
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.profile-selector {
  padding: 0 12px;
  margin-bottom: 8px;
}

.selector-label {
  font-size: 11px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.profile-display {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 34px;
  padding: 4px 6px;
  border-radius: 8px;
  background: $bg-secondary;
  border: 1px solid $border-color;
  cursor: pointer;
}

.profile-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  flex: 0 0 auto;
  background: $bg-card;

  :deep(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.profile-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
}

.profile-popover {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-popover-header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.profile-popover-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  background: $bg-secondary;
  flex: 0 0 auto;

  :deep(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.profile-popover-title {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile-popover-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 700;
  color: $text-primary;
}

.profile-popover-subtitle,
.runtime-label,
.runtime-detail {
  font-size: 12px;
  color: $text-muted;
}

.runtime-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 62px;
}

.profile-runtime-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  min-height: 96px;
  overflow-y: auto;
}

.profile-runtime-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid $border-color;
  border-radius: 8px;
  background: $bg-card;

  &.active {
    border-color: $accent-muted;
    background: $bg-card-hover;
  }
}

.profile-runtime-main {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.profile-runtime-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  flex: 0 0 auto;
  background: $bg-secondary;

  :deep(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.profile-runtime-info {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.profile-runtime-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.profile-runtime-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: $text-primary;
}

.active-badge {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, $success 16%, transparent);
  color: $success;
  font-size: 10px;
  font-weight: 700;
}

.profile-runtime-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(88px, max-content));
  justify-content: end;
  gap: 6px;

  :deep(.n-button) {
    min-width: 88px;
  }
}

.runtime-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  &.compact {
    gap: 8px;
  }
}

.runtime-value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: $text-secondary;
  font-size: 12px;
  font-weight: 600;

  &.running {
    color: $success;

    .runtime-dot {
      background: $success;
    }
  }
}

.runtime-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: $text-muted;
}

.runtime-detail {
  line-height: 1.4;
  word-break: break-word;
}
</style>

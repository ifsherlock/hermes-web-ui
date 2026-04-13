<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import MessageItem from './MessageItem.vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const { t } = useI18n()
const listRef = ref<HTMLElement>()

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) {
      listRef.value.scrollTop = listRef.value.scrollHeight
    }
  })
}

watch(() => chatStore.messages.length, scrollToBottom)
watch(() => chatStore.messages[chatStore.messages.length - 1]?.content, scrollToBottom)
watch(() => chatStore.isStreaming, (v) => { if (v) scrollToBottom() })
</script>

<template>
  <div ref="listRef" class="message-list">
    <div v-if="chatStore.messages.length === 0" class="empty-state">
      <img src="/assets/logo.png" alt="Hermes" class="empty-logo" />
      <p>{{ t('chat.emptyState') }}</p>
    </div>
    <MessageItem
      v-for="msg in chatStore.messages"
      :key="msg.id"
      :message="msg"
    />
    <div v-if="chatStore.isStreaming" class="streaming-indicator">
      <span></span><span></span><span></span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/variables' as *;

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: $text-muted;
  gap: 12px;

  .empty-logo {
    width: 48px;
    height: 48px;
    opacity: 0.25;
  }

  p {
    font-size: 14px;
  }
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  color: $text-muted;

  span {
    width: 5px;
    height: 5px;
    background-color: $text-muted;
    border-radius: 50%;
    animation: stream-pulse 1.4s infinite ease-in-out;

    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
}

@keyframes stream-pulse {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
</style>

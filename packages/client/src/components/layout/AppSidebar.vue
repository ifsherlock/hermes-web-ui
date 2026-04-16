<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/hermes/app";
import ModelSelector from "./ModelSelector.vue";
import LanguageSwitch from "./LanguageSwitch.vue";
import danceVideo from "@/assets/dance.mp4";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const canvasRef = ref<HTMLCanvasElement>();

const selectedKey = computed(() => route.name as string);

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const video = document.createElement("video");
  video.src = danceVideo;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;

  video.addEventListener("loadeddata", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  });

  function draw() {
    if (video.readyState >= 2 && ctx && canvas) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    if (video.currentTime >= video.duration - 0.05) {
      video.currentTime = 0;
    }
    requestAnimationFrame(draw);
  }

  video.addEventListener("canplay", () => {
    draw();
  });

  video.play();

  const onVisible = () => {
    if (document.visibilityState === "visible" && video.paused) {
      video.play();
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  onUnmounted(() => {
    document.removeEventListener("visibilitychange", onVisible);
  });
});

function handleNav(key: string) {
  router.push({ name: key });
}
</script>

<template>
  <aside class="sidebar" :class="{ open: appStore.sidebarOpen }">
    <div class="sidebar-logo" @click="router.push('/hermes/chat')">
      <img src="/logo.png" alt="Hermes" class="logo-img" />
      <span class="logo-text">Hermes</span>
      <canvas ref="canvasRef" class="logo-dance" />
    </div>

    <nav class="sidebar-nav">
      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.chat' }"
        @click="handleNav('hermes.chat')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
          />
        </svg>
        <span>{{ t("sidebar.chat") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.jobs' }"
        @click="handleNav('hermes.jobs')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span>{{ t("sidebar.jobs") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.models' }"
        @click="handleNav('hermes.models')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4" />
          <path d="M12 19v4" />
          <path d="M1 12h4" />
          <path d="M19 12h4" />
          <path d="M4.22 4.22l2.83 2.83" />
          <path d="M16.95 16.95l2.83 2.83" />
          <path d="M4.22 19.78l2.83-2.83" />
          <path d="M16.95 7.05l2.83-2.83" />
        </svg>
        <span>{{ t("sidebar.models") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.profiles' }"
        @click="handleNav('hermes.profiles')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>{{ t("sidebar.profiles") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.channels' }"
        @click="handleNav('hermes.channels')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <span>{{ t("sidebar.channels") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.skills' }"
        @click="handleNav('hermes.skills')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <span>{{ t("sidebar.skills") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.memory' }"
        @click="handleNav('hermes.memory')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
        </svg>
        <span>{{ t("sidebar.memory") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.logs' }"
        @click="handleNav('hermes.logs')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
          />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        <span>{{ t("sidebar.logs") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.usage' }"
        @click="handleNav('hermes.usage')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="7" width="4" height="14" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </svg>
        <span>{{ t("sidebar.usage") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.terminal' }"
        @click="handleNav('hermes.terminal')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <span>{{ t("sidebar.terminal") }}</span>
      </button>

      <button
        class="nav-item"
        :class="{ active: selectedKey === 'hermes.settings' }"
        @click="handleNav('hermes.settings')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
        <span>{{ t("sidebar.settings") }}</span>
      </button>
    </nav>

    <ModelSelector />

    <div class="sidebar-footer">
      <div class="status-row">
        <div
          class="status-indicator"
          :class="{
            connected: appStore.connected,
            disconnected: !appStore.connected,
          }"
        >
          <span class="status-dot"></span>
          <span class="status-text">{{
            appStore.connected
              ? t("sidebar.connected")
              : t("sidebar.disconnected")
          }}</span>
        </div>
        <LanguageSwitch />
      </div>
      <div class="version-info">
        Hermes {{ appStore.serverVersion || "v0.1.0" }}
      </div>
    </div>
  </aside>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.sidebar {
  width: $sidebar-width;
  height: calc(100 * var(--vh));
  background-color: $bg-sidebar;
  border-right: 1px solid $border-color;
  display: flex;
  flex-direction: column;
  padding: 0 12px 20px;
  flex-shrink: 0;
  transition: width $transition-normal;
}

.logo-img {
  width: 28px;
  height: 28px;
  border-radius: 0;
  flex-shrink: 0;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 12px;
  margin: 0 -12px;
  color: $text-primary;
  cursor: pointer;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;

  .logo-text {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .logo-dance {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    height: 100px;
    border-radius: $radius-md;
    object-fit: contain;
    flex-shrink: 0;
    width: auto;
  }
}

.sidebar-nav {
  flex: 1;
  display: flex;
  padding-top: 12px;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
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

@media (max-width: $breakpoint-mobile) {
  .logo-dance {
    display: none;
  }

  .status-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform $transition-normal;

    &.open {
      transform: translateX(0);
    }

    // Override global utility — sidebar is always 240px wide
    .input-sm {
      width: 90px;
    }
  }
}
</style>

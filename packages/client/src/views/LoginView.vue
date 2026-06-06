<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  getServerUrlValue,
  hasApiKey,
  normalizeServerUrlValue,
  setApiKey,
  setServerUrl,
} from "@/api/client";
import { fetchAuthStatus, loginWithPassword } from "@/api/auth";
import { useTheme } from "@/composables/useTheme";

const { t } = useI18n();
const router = useRouter();
const { isPerson5 } = useTheme();

const username = ref("");
const password = ref("");
const serverUrl = ref(getServerUrlValue());
const loading = ref(false);
const errorMsg = ref("");
const showLockResetHint = ref(false);
const p5BrandChars = computed(() => Array.from("卢布朗咖啡店"));
const usePerson5Login = computed(() => isPerson5.value);
let shouldRestorePerson5 = false;

if (hasApiKey()) {
  router.replace("/hermes/chat");
}

onMounted(async () => {
  shouldRestorePerson5 = usePerson5Login.value || document.documentElement.classList.contains("person5");
  if (usePerson5Login.value) {
    document.documentElement.classList.add("p5-login-active");
    document.documentElement.classList.remove("person5");
  }
  try {
    await fetchAuthStatus();
  } catch {
    // Login remains available; the submit request will surface connection errors.
  }
});

onUnmounted(() => {
  document.documentElement.classList.remove("p5-login-active");
  if (shouldRestorePerson5 || isPerson5.value) {
    document.documentElement.classList.add("person5");
  }
});

async function handleLogin() {
  await handlePasswordLogin();
}

function persistServerUrl() {
  const normalizedServerUrl = normalizeServerUrlValue(serverUrl.value);
  setServerUrl(normalizedServerUrl);
  serverUrl.value = normalizedServerUrl;
}

async function handlePasswordLogin() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = t("login.credentialsRequired");
    return;
  }

  persistServerUrl();

  loading.value = true;
  errorMsg.value = "";
  showLockResetHint.value = false;

  try {
    const sessionToken = await loginWithPassword(username.value.trim(), password.value);
    setApiKey(sessionToken);
    router.replace("/hermes/chat");
  } catch (err: any) {
    if (err.status === 429 || err.status === 503) {
      errorMsg.value = t("login.tooManyAttempts");
      showLockResetHint.value = true;
    } else {
      errorMsg.value = err.message || t("login.invalidCredentials");
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-view" :class="{ 'p5-login-view': usePerson5Login || isPerson5 }">
    <div v-if="usePerson5Login || isPerson5" class="p5-login-scene" aria-hidden="true">
      <span class="p5-login-noise"></span>
      <span class="p5-login-slash p5-login-slash-one"></span>
      <span class="p5-login-slash p5-login-slash-two"></span>
      <span class="p5-login-slogan">TAKE YOUR HEART</span>
    </div>

    <div v-if="usePerson5Login || isPerson5" class="p5-login-brand" aria-hidden="true">
      <span class="p5-login-kanji">
        <span v-for="(char, index) in p5BrandChars" :key="`${char}-${index}`" class="p5-login-char">
          {{ char }}
        </span>
      </span>
      <span class="p5-login-en">CAFÉ LEBLANC</span>
    </div>

    <div class="login-card">
      <span class="p5-login-shard p5-login-shard-red" aria-hidden="true"></span>
      <span class="p5-login-shard p5-login-shard-white" aria-hidden="true"></span>

      <div class="login-logo">
        <img src="/logo.png" alt="Hermes" width="80" height="80" />
      </div>

      <div v-if="usePerson5Login || isPerson5" class="p5-login-title-wrap">
        <span class="p5-login-title-main">怪盗团终端</span>
        <span class="p5-login-title-sub">HERMES WEB UI</span>
      </div>
      <h1 v-else class="login-title">{{ t("login.title") }}</h1>

      <p class="login-desc">{{ usePerson5Login || isPerson5 ? "输入暗号，进入作战频道。" : t("login.description") }}</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <label class="login-server-field">
          <span class="login-server-label">服务器地址</span>
          <input
            v-model="serverUrl"
            type="text"
            class="login-input"
            placeholder="留空使用当前地址，例如：http://nas-host:6060"
            autocomplete="url"
            autocapitalize="off"
            spellcheck="false"
            @blur="persistServerUrl"
            @change="persistServerUrl"
          />
        </label>
        <input
          v-model="username"
          type="text"
          class="login-input"
          :placeholder="t('login.usernamePlaceholder')"
          autocomplete="username"
          autocapitalize="off"
          spellcheck="false"
          autofocus
        />
        <input
          v-model="password"
          type="password"
          class="login-input"
          :placeholder="t('login.passwordPlaceholder')"
          autocomplete="current-password"
          @keyup.enter="handleLogin"
        />

        <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>
        <div v-if="showLockResetHint" class="login-lock-hint">
          <span>{{ t("login.lockResetHint") }}</span>
          <code>hermes-web-ui clear-login-locks --restart</code>
          <span>{{ t("login.defaultLoginResetHint") }}</span>
          <code>hermes-web-ui reset-default-login</code>
        </div>

        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? "..." : t("login.submit") }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.login-view {
  position: relative;
  z-index: 1;
  display: flex;
  height: calc(100 * var(--vh));
  align-items: center;
  justify-content: center;
  background: $bg-primary;
}

.login-card {
  position: relative;
  z-index: 2;
  width: 480px;
  max-width: calc(100vw - 32px);
  padding: 56px;
  border: 1px solid $border-color;
  border-radius: $radius-lg;
  background: $bg-card;
  text-align: center;

  @media (max-width: $breakpoint-mobile) {
    padding: 32px 24px;
  }
}

.login-logo {
  margin-bottom: 24px;
}

.login-title {
  margin: 0 0 10px;
  color: $text-primary;
  font-size: 26px;
  font-weight: 600;
}

.login-desc {
  margin: 0 0 12px;
  color: $text-muted;
  font-size: 14px;
  line-height: 1.6;
}

.login-default-hint {
  margin: 0 0 28px;
  color: $text-secondary;
  font-family: $font-code;
  font-size: 13px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-server-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.login-server-label {
  color: $text-secondary;
  font-size: 12px;
  font-weight: 600;
}

.login-input {
  display: block;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(17, 17, 17, 0.28);
  border-radius: $radius-sm;
  outline: none;
  background: #fff7ec;
  color: #111111;
  caret-color: #e30012;
  box-sizing: border-box;
  font-family: $font-code;
  font-size: 15px;
  pointer-events: auto;
  transition: border-color $transition-fast;
  user-select: text;

  &::placeholder {
    color: rgba(17, 17, 17, 0.45);
  }

  &:focus {
    border-color: #e30012;
    box-shadow: 0 0 0 3px rgba(227, 0, 18, 0.18);
  }
}

.login-error {
  color: $error;
  font-size: 13px;
  text-align: left;
}

.login-lock-hint {
  padding: 10px 12px;
  border: 1px solid rgba(var(--warning-rgb), 0.35);
  border-radius: $radius-sm;
  background: rgba(var(--warning-rgb), 0.08);
  color: $text-secondary;
  font-size: 12px;
  line-height: 1.5;
  text-align: left;

  code {
    display: block;
    margin-top: 4px;
    color: $text-primary;
    font-family: $font-code;
    word-break: break-all;
  }
}

.login-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: $radius-sm;
  background: $text-primary;
  color: var(--text-on-accent);
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: opacity $transition-fast;

  &:hover {
    opacity: 0.85;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

:global(html.person5) .p5-login-view {
  width: 100% !important;
  min-width: 100% !important;
  height: calc(100 * var(--vh)) !important;
  min-height: calc(100 * var(--vh)) !important;
  overflow: hidden !important;
  background:
    linear-gradient(98deg, rgba(0, 0, 0, 0.94) 0 29%, rgba(230, 0, 18, 0.42) 29% 53%, rgba(0, 0, 0, 0.88) 53% 100%),
    url('/person5/login-wallpaper.webp') center / cover no-repeat,
    #050505 !important;
}

:global(html.person5) .p5-login-scene,
:global(html.person5) .p5-login-noise,
:global(html.person5) .p5-login-slash,
:global(html.person5) .p5-login-slogan {
  position: absolute;
  pointer-events: none;
}

:global(html.person5) .p5-login-scene {
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

:global(html.person5) .p5-login-noise {
  inset: 0;
  opacity: 0.84;
  background:
    radial-gradient(circle, rgba(255, 248, 236, 0.20) 0 1.5px, transparent 2px) 0 0 / 28px 28px,
    radial-gradient(circle, rgba(230, 0, 18, 0.18) 0 1.5px, transparent 2px) 12px 14px / 34px 34px,
    repeating-linear-gradient(116deg, transparent 0 30px, rgba(255, 248, 236, 0.09) 30px 33px, transparent 33px 70px);
  mix-blend-mode: screen;
}

:global(html.person5) .p5-login-slash {
  background: #e60012;
  box-shadow:
    14px 14px 0 #050505,
    -8px -8px 0 #fff7e8;
  clip-path: polygon(6% 0, 100% 15%, 91% 100%, 0 82%);
}

:global(html.person5) .p5-login-slash-one {
  left: -9vw;
  top: 16vh;
  width: 46vw;
  height: 15vh;
  transform: rotate(-15deg);
}

:global(html.person5) .p5-login-slash-two {
  right: -8vw;
  bottom: 8vh;
  width: 52vw;
  height: 18vh;
  transform: rotate(-12deg);
}

:global(html.person5) .p5-login-slogan {
  left: -3vw;
  bottom: 4vh;
  color: rgba(230, 0, 18, 0.48);
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(64px, 9vw, 168px);
  font-style: italic;
  font-weight: 900;
  line-height: 0.9;
  transform: rotate(-9deg);
  white-space: nowrap;
}

:global(html.person5) .p5-login-brand {
  position: absolute;
  left: clamp(48px, 5vw, 108px);
  top: clamp(34px, 5vh, 76px);
  z-index: 3;
  display: flex;
  align-items: center;
  filter: drop-shadow(8px 8px 0 #050505);
  transform: rotate(-2deg);
}

:global(html.person5) .p5-login-kanji {
  display: flex;
  gap: 2px;
  align-items: center;
}

:global(html.person5) .p5-login-char {
  display: inline-grid;
  min-width: clamp(30px, 2.45vw, 48px);
  min-height: clamp(34px, 2.7vw, 54px);
  place-items: center;
  padding: 4px 6px 8px;
  border: 3px solid #050505;
  outline: 2px solid #fff7e8;
  background: #e60012;
  color: #fff7e8;
  font-size: clamp(22px, 2.1vw, 42px);
  font-weight: 1000;
  line-height: 1;
  text-shadow: 3px 3px 0 #050505;
  transform: skewX(-8deg);
}

:global(html.person5) .p5-login-char:nth-child(even) {
  background: #050505;
  outline-color: #e60012;
}

:global(html.person5) .p5-login-char:nth-child(3n) {
  transform: translateY(7px) skewX(-8deg) rotate(2deg);
}

:global(html.person5) .p5-login-en {
  margin-left: -4px;
  padding: 10px 28px 12px;
  border-top: 3px solid #fff7e8;
  border-bottom: 3px solid #fff7e8;
  background: #050505;
  color: #fff7e8;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(18px, 1.9vw, 36px);
  font-style: italic;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1;
  text-shadow: 3px 3px 0 #e60012;
  transform: translateY(12px) skewX(-12deg);
}

:global(html.person5) .p5-login-view .login-card {
  width: min(560px, calc(100vw - 40px)) !important;
  margin-left: clamp(280px, 25vw, 520px) !important;
  padding: 50px 54px 48px !important;
  border: 6px solid #fff7e8 !important;
  outline: 5px solid #050505 !important;
  border-radius: 0 !important;
  background: rgba(5, 5, 5, 0.94) !important;
  box-shadow:
    18px 18px 0 #e60012,
    28px 28px 0 #050505 !important;
  color: #fff7e8 !important;
  clip-path: polygon(0 7%, 91% 0, 100% 16%, 94% 100%, 7% 93%, 0 78%) !important;
  text-align: center !important;
  transform: rotate(-1.2deg) skewX(-3deg) !important;
}

:global(html.person5) .p5-login-view .login-card > * {
  position: relative;
  z-index: 2;
  transform: skewX(3deg);
}

:global(html.person5) .p5-login-shard {
  position: absolute !important;
  z-index: 1 !important;
  pointer-events: none;
}

:global(html.person5) .p5-login-shard-red {
  left: -54px;
  top: 26px;
  width: 168px;
  height: 72px;
  background: #e60012;
  clip-path: polygon(0 20%, 100% 0, 76% 100%, 18% 78%);
}

:global(html.person5) .p5-login-shard-white {
  right: -42px;
  bottom: 42px;
  width: 132px;
  height: 60px;
  background: #fff7e8;
  box-shadow: 7px 7px 0 #050505;
  clip-path: polygon(12% 0, 100% 20%, 82% 88%, 0 100%);
}

:global(html.person5) .p5-login-view .login-logo {
  display: grid;
  width: 128px;
  height: 128px;
  margin: 0 auto 24px !important;
  place-items: center;
  border: 5px solid #fff7e8;
  outline: 5px solid #050505;
  background: #e60012;
  box-shadow: 9px 9px 0 #050505;
  clip-path: polygon(0 10%, 90% 0, 100% 18%, 92% 100%, 12% 92%, 0 74%);
}

:global(html.person5) .p5-login-view .login-logo img {
  width: 88px;
  height: 88px;
  object-fit: contain;
}

:global(html.person5) .p5-login-title-wrap {
  display: grid;
  width: max-content;
  max-width: 100%;
  margin: 0 auto 12px;
  gap: 6px;
  justify-items: center;
}

:global(html.person5) .p5-login-title-main {
  padding: 8px 18px 11px;
  border: 4px solid #050505;
  outline: 3px solid #fff7e8;
  background: #e60012;
  color: #fff7e8;
  box-shadow: 6px 6px 0 #050505;
  font-size: clamp(32px, 2.4vw, 46px);
  font-weight: 1000;
  line-height: 1;
  text-shadow: 3px 3px 0 #050505;
  transform: rotate(-2deg) skewX(-6deg);
}

:global(html.person5) .p5-login-title-sub {
  padding: 4px 14px 5px;
  border: 2px solid #fff7e8;
  background: #050505;
  color: #fff7e8;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 15px;
  font-style: italic;
  font-weight: 900;
  letter-spacing: 0.08em;
  transform: rotate(1deg) skewX(-8deg);
}

:global(html.person5) .p5-login-view .login-desc,
:global(html.person5) .p5-login-view .login-default-hint,
:global(html.person5) .p5-login-view .login-server-label {
  color: #fff7e8 !important;
  text-shadow: 2px 2px 0 #050505;
}

:global(html.person5) .p5-login-view .login-default-hint {
  display: inline-block;
  padding: 5px 12px;
  border: 2px solid #fff7e8;
  background: #050505;
  box-shadow: 4px 4px 0 #e60012;
}

:global(html.person5) .p5-login-view .login-input {
  position: relative;
  z-index: 3;
  min-height: 58px;
  border: 3px solid #050505 !important;
  outline: 3px solid #fff7e8 !important;
  border-radius: 0 !important;
  background: #fff7e8 !important;
  box-shadow:
    6px 6px 0 #e60012,
    9px 9px 0 #050505 !important;
  color: #050505 !important;
  caret-color: #e60012 !important;
  clip-path: polygon(0 14%, 94% 0, 100% 50%, 94% 100%, 0 86%) !important;
  font-size: 17px !important;
  font-weight: 900 !important;
}

:global(html.person5) .p5-login-view .login-input::placeholder {
  color: rgba(5, 5, 5, 0.62) !important;
}

:global(html.person5) .p5-login-view .login-btn {
  position: relative;
  z-index: 3;
  min-height: 62px;
  margin-top: 10px;
  border: 4px solid #050505 !important;
  outline: 3px solid #fff7e8 !important;
  border-radius: 0 !important;
  background: #e60012 !important;
  box-shadow: 8px 8px 0 #050505 !important;
  color: #fff7e8 !important;
  clip-path: polygon(0 16%, 88% 0, 100% 50%, 88% 100%, 0 84%, 5% 50%) !important;
  font-size: 20px !important;
  font-weight: 1000 !important;
  text-shadow: 2px 2px 0 #050505;
  transform: rotate(-1deg) skewX(-5deg) !important;
}

:global(html.person5) .p5-login-view .login-btn:hover:not(:disabled) {
  opacity: 1;
  transform: translateY(-2px) rotate(-1deg) skewX(-5deg) !important;
}

:global(html.person5) .p5-login-view .login-error,
:global(html.person5) .p5-login-view .login-lock-hint {
  border: 2px solid #fff7e8 !important;
  background: #050505 !important;
  box-shadow: 4px 4px 0 #e60012 !important;
  color: #fff7e8 !important;
}

@media (max-width: 900px) {
  :global(html.person5) .p5-login-brand {
    left: 16px;
    top: 18px;
    transform: scale(0.72) rotate(-2deg);
    transform-origin: left top;
  }

  :global(html.person5) .p5-login-view {
    align-items: flex-end;
    padding: 132px 18px 34px;
  }

  :global(html.person5) .p5-login-view .login-card {
    width: min(100%, 520px) !important;
    margin-left: 0 !important;
    padding: 38px 26px 34px !important;
    transform: rotate(-0.8deg) !important;
  }
}
</style>

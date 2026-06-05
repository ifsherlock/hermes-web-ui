<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { setApiKey, hasApiKey } from "@/api/client";
import { fetchAuthStatus, loginWithPassword } from "@/api/auth";

const { t } = useI18n();
const router = useRouter();

const username = ref("");
const password = ref("");
const loading = ref(false);
const errorMsg = ref("");
const showLockResetHint = ref(false);

// If already has a key, try to go to main page
if (hasApiKey()) {
  router.replace("/hermes/chat");
}

onMounted(async () => {
  try {
    await fetchAuthStatus();
  } catch {
    // Login remains available; the submit request will surface connection errors.
  }
});

async function handleLogin() {
  await handlePasswordLogin();
}

async function handlePasswordLogin() {
  if (!username.value.trim() || !password.value) {
    errorMsg.value = t("login.credentialsRequired");
    return;
  }

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
  <div class="login-view">
    <div class="p5-login-brand" aria-hidden="true">
      <span class="p5-login-kanji">卢布朗咖啡店</span>
      <span class="p5-login-en">CAFÉ LEBLANC</span>
    </div>
    <div class="login-card">
      <span class="p5-login-shard p5-login-shard-red" aria-hidden="true"></span>
      <span class="p5-login-shard p5-login-shard-white" aria-hidden="true"></span>
      <div class="login-logo">
        <img src="/logo.png" alt="Hermes" width="80" height="80" />
      </div>
      <h1 class="login-title">{{ t("login.title") }}</h1>
      <p class="login-desc">{{ t("login.description") }}</p>
      <p class="login-default-hint">{{ t("login.defaultCredentialsHint") }}</p>

      <form class="login-form" @submit.prevent="handleLogin">
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
  height: calc(100 * var(--vh));
  display: flex;
  align-items: center;
  justify-content: center;
  background: $bg-primary;
  position: relative;
  z-index: 1;
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
  font-size: 26px;
  font-weight: 600;
  color: $text-primary;
  margin: 0 0 10px;
}

.login-desc {
  font-size: 14px;
  color: $text-muted;
  margin: 0 0 12px;
  line-height: 1.6;
}

.login-default-hint {
  margin: 0 0 28px;
  font-family: $font-code;
  font-size: 13px;
  color: $text-secondary;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-input {
  display: block;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(17, 17, 17, 0.28);
  border-radius: $radius-sm;
  font-size: 15px;
  color: #111111;
  background: #fff7ec;
  outline: none;
  transition: border-color $transition-fast;
  box-sizing: border-box;
  font-family: $font-code;
  caret-color: #e30012;
  pointer-events: auto;
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
  font-size: 13px;
  color: $error;
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
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity $transition-fast;

  &:hover {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

:global(html.person5) .login-view {
  overflow: hidden;
  background:
    linear-gradient(105deg, rgba(0, 0, 0, 0.92) 0 32%, rgba(190, 0, 28, 0.58) 32% 58%, rgba(0, 0, 0, 0.86) 58%),
    url('/person5/login-wallpaper.webp') center / cover no-repeat,
    #050505;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 0;
    background:
      repeating-linear-gradient(116deg, transparent 0 20px, rgba(255, 255, 255, 0.08) 20px 22px, transparent 22px 48px),
      radial-gradient(circle at 18% 35%, rgba(255, 255, 255, 0.12) 0 2px, transparent 2px 8px);
    mix-blend-mode: screen;
    pointer-events: none;
  }

  &::after {
    content: "TAKE YOUR HEART";
    position: absolute;
    left: -3vw;
    bottom: 5vh;
    z-index: 0;
    color: rgba(199, 0, 27, 0.42);
    font-family: Georgia, 'Times New Roman', serif;
    font-size: clamp(58px, 8vw, 150px);
    font-style: italic;
    font-weight: 900;
    letter-spacing: 0.08em;
    transform: rotate(-9deg);
    pointer-events: none;
  }
}

:global(html.person5) .p5-login-brand {
  position: absolute;
  left: clamp(28px, 5vw, 96px);
  top: clamp(26px, 5vh, 72px);
  z-index: 2;
  display: flex;
  align-items: center;
  filter: drop-shadow(8px 8px 0 #050505);
  transform: rotate(-2deg);
}

:global(html.person5) .p5-login-kanji {
  padding: 10px 18px 12px;
  color: #fff7e8;
  background: #c9001b;
  border: 4px solid #050505;
  outline: 3px solid #fff7e8;
  font-size: clamp(24px, 2.6vw, 52px);
  font-weight: 1000;
  line-height: 1;
  text-shadow: 3px 3px 0 #050505;
  transform: skewX(-7deg);
}

:global(html.person5) .p5-login-en {
  margin-left: -8px;
  padding: 9px 28px 10px;
  color: #fff7e8;
  background: #050505;
  border-top: 3px solid #fff7e8;
  border-bottom: 3px solid #fff7e8;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: clamp(18px, 2vw, 38px);
  font-style: italic;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1;
  text-transform: uppercase;
  transform: skewX(-12deg) translateY(10px);
}

:global(html.person5) .login-card {
  width: min(520px, calc(100vw - 34px));
  padding: 62px 58px 54px;
  color: #fff7e8;
  background: rgba(5, 5, 5, 0.94);
  border: 6px solid #fff7e8;
  outline: 5px solid #050505;
  border-radius: 0;
  box-shadow: 18px 18px 0 #c9001b, 28px 28px 0 #050505;
  clip-path: polygon(0 7%, 91% 0, 100% 16%, 94% 100%, 7% 93%, 0 78%);
  transform: rotate(-1.2deg) skewX(-3deg);
  pointer-events: auto;
}

:global(html.person5) .login-card > * {
  position: relative;
  z-index: 2;
  transform: skewX(3deg);
}

:global(html.person5) .p5-login-shard {
  position: absolute;
  z-index: -1;
  pointer-events: none;
}

:global(html.person5) .p5-login-shard-red {
  left: -42px;
  top: 18px;
  width: 150px;
  height: 72px;
  background: #c9001b;
  clip-path: polygon(0 20%, 100% 0, 76% 100%, 18% 78%);
}

:global(html.person5) .p5-login-shard-white {
  right: -38px;
  bottom: 38px;
  width: 120px;
  height: 58px;
  background: #fff7e8;
  box-shadow: 7px 7px 0 #050505;
  clip-path: polygon(12% 0, 100% 20%, 82% 88%, 0 100%);
}

:global(html.person5) .login-logo {
  width: 112px;
  height: 112px;
  margin: 0 auto 28px;
  display: grid;
  place-items: center;
  background: #c9001b;
  border: 5px solid #fff7e8;
  outline: 4px solid #050505;
  box-shadow: 8px 8px 0 #050505;
  clip-path: polygon(0 10%, 90% 0, 100% 18%, 92% 100%, 12% 92%, 0 74%);

  img {
    width: 82px;
    height: 82px;
    object-fit: contain;
  }
}

:global(html.person5) .login-title {
  width: max-content;
  max-width: 100%;
  margin: 0 auto 12px;
  padding: 8px 18px 10px;
  color: #fff7e8;
  background: #c9001b;
  border: 3px solid #050505;
  outline: 3px solid #fff7e8;
  box-shadow: 5px 5px 0 #050505;
  font-size: clamp(28px, 2.2vw, 42px);
  font-weight: 1000;
  line-height: 1;
  text-shadow: 3px 3px 0 #050505;
  transform: rotate(-2deg) skewX(-5deg);
}

:global(html.person5) .login-desc,
:global(html.person5) .login-default-hint {
  color: #fff7e8;
  text-shadow: 2px 2px 0 #050505;
}

:global(html.person5) .login-default-hint {
  display: inline-block;
  padding: 4px 12px;
  background: #050505;
  border: 2px solid #fff7e8;
  box-shadow: 4px 4px 0 #c9001b;
}

:global(html.person5) .login-input {
  position: relative;
  z-index: 3;
  min-height: 54px;
  color: #050505;
  background: #fff7e8;
  border: 3px solid #050505;
  outline: 3px solid #fff7e8;
  box-shadow: 6px 6px 0 #c9001b, 9px 9px 0 #050505;
  border-radius: 0;
  font-size: 17px;
  font-weight: 800;
  clip-path: polygon(0 14%, 94% 0, 100% 50%, 94% 100%, 0 86%);
  pointer-events: auto;
}

:global(html.person5) .login-input::placeholder {
  color: rgba(5, 5, 5, 0.62);
}

:global(html.person5) .login-btn {
  position: relative;
  z-index: 3;
  min-height: 58px;
  margin-top: 8px;
  color: #fff7e8;
  background: #c9001b;
  border: 4px solid #050505;
  outline: 3px solid #fff7e8;
  border-radius: 0;
  box-shadow: 7px 7px 0 #050505;
  clip-path: polygon(0 16%, 88% 0, 100% 50%, 88% 100%, 0 84%, 5% 50%);
  font-size: 18px;
  font-weight: 1000;
  text-shadow: 2px 2px 0 #050505;
  transform: rotate(-1deg) skewX(-5deg);
  pointer-events: auto;
}

:global(html.person5) .login-error,
:global(html.person5) .login-lock-hint {
  color: #fff7e8;
  background: #050505;
  border: 2px solid #fff7e8;
  box-shadow: 4px 4px 0 #c9001b;
}

@media (max-width: $breakpoint-mobile) {
  :global(html.person5) .p5-login-brand {
    left: 14px;
    top: 18px;
    transform: scale(0.72) rotate(-2deg);
    transform-origin: left top;
  }

  :global(html.person5) .login-card {
    padding: 42px 28px 38px;
    transform: rotate(-0.8deg);
  }
}
</style>

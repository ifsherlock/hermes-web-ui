<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { NButton, NModal, useMessage } from "naive-ui";
import { useAppStore } from "@/stores/hermes/app";
import { useProfilesStore } from "@/stores/hermes/profiles";
import { restartProfileGateway, restartProfileRuntime } from "@/api/hermes/profiles";
import ProfileAvatarView from "@/components/hermes/profiles/ProfileAvatar.vue";
import ModelSelector from "./ModelSelector.vue";
import ProfileSelector from "./ProfileSelector.vue";
import LanguageSwitch from "./LanguageSwitch.vue";
import ThemeSwitch from "./ThemeSwitch.vue";
import { useSessionSearch } from '@/composables/useSessionSearch'
import { usePersistentRecord } from '@/composables/usePersistentRecord'
import { useTheme } from '@/composables/useTheme'
import RouteLinkItem from '@/components/common/RouteLinkItem.vue'
import { changelog } from "@/data/changelog";
import { clearApiKey, isStoredSuperAdmin } from "@/api/client";

const { t } = useI18n();
const message = useMessage();
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const profilesStore = useProfilesStore();
const { isPerson5 } = useTheme();
const { openSessionSearch } = useSessionSearch();
const selectedKey = computed(() => {
  if (route.name === "hermes.session") return "hermes.chat";
  if (route.name === "hermes.historySession") return "hermes.history";
  if (route.name === "hermes.groupChatRoom") return "hermes.groupChat";
  return route.name as string;
});
const isSuperAdmin = computed(() => isStoredSuperAdmin());
const isVersionPreview = import.meta.env.VITE_HERMES_PREVIEW === '1';

function isNavActive(...names: string[]) {
  return names.includes(selectedKey.value);
}
function hasRoute(name: string): boolean {
  return router.hasRoute(name);
}
const logoPath = '/logo.png';

const { record: collapsedGroups, persist: persistCollapsedGroups } = usePersistentRecord('hermes.sidebar.collapsedGroups');

type SidebarGroupKey = "Conversation" | "Agent" | "Monitoring" | "Tools" | "System";
type Person5ControlKey = "profile" | "model";
type P5CollapsedGroupKey = "conversation" | "agent" | "monitoring" | "tools" | "system";
type P5CollapsedIconItem = {
  key: string;
  label: string;
  icon: string;
  routeName?: string;
  beta?: boolean;
  superAdminOnly?: boolean;
  hidden?: () => boolean;
  action?: () => void;
};

const p5CollapsedGroups: Array<{ key: P5CollapsedGroupKey; label: string; active: () => boolean }> = [
  { key: "conversation", label: "对话", active: () => isNavActive("hermes.chat", "hermes.session", "hermes.history", "hermes.historySession", "hermes.groupChat", "hermes.groupChatRoom") },
  { key: "agent", label: "代理", active: () => isNavActive("hermes.jobs", "hermes.kanban", "hermes.channels", "hermes.skills", "hermes.plugins", "hermes.mcp", "hermes.memory", "hermes.models") },
  { key: "monitoring", label: "监控", active: () => isNavActive("hermes.logs", "hermes.usage", "hermes.performance", "hermes.skillsUsage") },
  { key: "tools", label: "工具", active: () => isNavActive("hermes.codingAgents", "hermes.versionPreview") },
  { key: "system", label: "系统", active: () => isNavActive("hermes.profiles", "hermes.settings") },
];

const p5CollapsedItems: Record<P5CollapsedGroupKey, P5CollapsedIconItem[]> = {
  conversation: [
    { key: "chat", label: "聊天", icon: "message", routeName: "hermes.chat" },
    { key: "history", label: "历史", icon: "clock", routeName: "hermes.history" },
    { key: "groupChat", label: "群聊", icon: "users", routeName: "hermes.groupChat", beta: true },
    { key: "search", label: "搜索", icon: "search", action: openSessionSearch },
  ],
  agent: [
    { key: "jobs", label: "任务", icon: "calendar", routeName: "hermes.jobs" },
    { key: "kanban", label: "看板", icon: "columns", routeName: "hermes.kanban" },
    { key: "channels", label: "渠道", icon: "moon", routeName: "hermes.channels" },
    { key: "skills", label: "技能", icon: "layers", routeName: "hermes.skills" },
    { key: "plugins", label: "插件", icon: "wrench", routeName: "hermes.plugins" },
    { key: "mcp", label: "MCP", icon: "terminal", routeName: "hermes.mcp" },
    { key: "memory", label: "记忆", icon: "bulb", routeName: "hermes.memory" },
    { key: "models", label: "模型", icon: "cpu", routeName: "hermes.models" },
  ],
  monitoring: [
    { key: "logs", label: "日志", icon: "file", routeName: "hermes.logs" },
    { key: "usage", label: "用量", icon: "bar", routeName: "hermes.usage" },
    { key: "performance", label: "性能", icon: "pulse", routeName: "hermes.performance", superAdminOnly: true },
    { key: "skillsUsage", label: "技能用量", icon: "pie", routeName: "hermes.skillsUsage" },
  ],
  tools: [
    { key: "codingAgents", label: "编码代理", icon: "code", routeName: "hermes.codingAgents" },
    { key: "versionPreview", label: "版本预览", icon: "box", routeName: "hermes.versionPreview", superAdminOnly: true, hidden: () => isVersionPreview },
  ],
  system: [
    { key: "profiles", label: "用户", icon: "user", routeName: "hermes.profiles", superAdminOnly: true },
    { key: "settings", label: "设置", icon: "settings", routeName: "hermes.settings" },
  ],
};

const p5IconPaths: Record<string, Array<Record<string, string>>> = {
  message: [{ tag: "path", d: "M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }],
  clock: [{ tag: "circle", cx: "12", cy: "12", r: "9" }, { tag: "path", d: "M12 7v6l4 2" }],
  users: [{ tag: "path", d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }, { tag: "circle", cx: "9", cy: "7", r: "4" }, { tag: "path", d: "M22 21v-2a4 4 0 0 0-3-3.7M16 3.3a4 4 0 0 1 0 7.4" }],
  search: [{ tag: "circle", cx: "11", cy: "11", r: "7" }, { tag: "path", d: "m20 20-3.5-3.5" }],
  calendar: [{ tag: "rect", x: "3", y: "4", width: "18", height: "17", rx: "2" }, { tag: "path", d: "M8 2v4M16 2v4M3 10h18" }],
  columns: [{ tag: "rect", x: "3", y: "3", width: "5", height: "18", rx: "1" }, { tag: "rect", x: "10", y: "3", width: "5", height: "12", rx: "1" }, { tag: "rect", x: "17", y: "3", width: "5", height: "18", rx: "1" }],
  moon: [{ tag: "path", d: "M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" }],
  layers: [{ tag: "path", d: "m12 2 10 5-10 5L2 7z" }, { tag: "path", d: "m2 12 10 5 10-5M2 17l10 5 10-5" }],
  wrench: [{ tag: "path", d: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2-2a4 4 0 0 1-5.2 5.2l-7.8 7.8a2.1 2.1 0 0 1-3-3l7.8-7.8a4 4 0 0 1 5.2-5.2z" }],
  terminal: [{ tag: "path", d: "m4 17 6-6-6-6" }, { tag: "path", d: "M12 19h8" }],
  bulb: [{ tag: "path", d: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" }],
  cpu: [{ tag: "rect", x: "7", y: "7", width: "10", height: "10", rx: "2" }, { tag: "path", d: "M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4" }],
  file: [{ tag: "path", d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }, { tag: "path", d: "M14 2v6h6M8 13h8M8 17h8" }],
  bar: [{ tag: "rect", x: "3", y: "12", width: "4", height: "8", rx: "1" }, { tag: "rect", x: "10", y: "7", width: "4", height: "13", rx: "1" }, { tag: "rect", x: "17", y: "4", width: "4", height: "16", rx: "1" }],
  pulse: [{ tag: "path", d: "M22 12h-4l-3 8L9 4l-3 8H2" }],
  pie: [{ tag: "path", d: "M21 12A9 9 0 1 1 12 3v9z" }, { tag: "path", d: "M12 3a9 9 0 0 1 9 9h-9z" }],
  code: [{ tag: "path", d: "m16 18 6-6-6-6M8 6l-6 6 6 6M14 4l-4 16" }],
  box: [{ tag: "path", d: "M21 16V8l-9-5-9 5v8l9 5z" }, { tag: "path", d: "M3.3 7.3 12 12l8.7-4.7M12 22V12" }],
  home: [{ tag: "path", d: "M3 11 12 3l9 8" }, { tag: "path", d: "M5 10v10h14V10" }, { tag: "path", d: "M9 20v-6h6v6" }],
  logout: [{ tag: "path", d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }, { tag: "path", d: "M16 17l5-5-5-5" }, { tag: "path", d: "M21 12H9" }],
  image: [{ tag: "rect", x: "3", y: "5", width: "18", height: "14", rx: "2" }, { tag: "circle", cx: "8", cy: "10", r: "2" }, { tag: "path", d: "m21 15-5-5L5 19" }],
  refresh: [{ tag: "path", d: "M21 12a9 9 0 0 1-15.5 6.2" }, { tag: "path", d: "M3 12A9 9 0 0 1 18.5 5.8" }, { tag: "path", d: "M18 2v4h4M6 22v-4H2" }],
  server: [{ tag: "rect", x: "3", y: "4", width: "18", height: "7", rx: "2" }, { tag: "rect", x: "3", y: "13", width: "18", height: "7", rx: "2" }, { tag: "path", d: "M7 8h.01M7 17h.01" }],
  user: [{ tag: "path", d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }, { tag: "circle", cx: "12", cy: "7", r: "4" }],
  settings: [{ tag: "circle", cx: "12", cy: "12", r: "3" }, { tag: "path", d: "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1-2.8-2.8.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2.8-2.8.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" }],
};

const P5CollapsedIcon = (props: { name: string }) => h(
  'svg',
  {
    class: 'p5-collapsed-svg-icon',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  },
  (p5IconPaths[props.name] || p5IconPaths.message).map(({ tag, ...attrs }) => h(tag, attrs)),
);

const p5CollapsedOpenGroup = ref<P5CollapsedGroupKey | null>(null);
const p5CollapsedAgentOpen = ref(false);

function toggleP5CollapsedGroup(key: P5CollapsedGroupKey) {
  p5CollapsedOpenGroup.value = p5CollapsedOpenGroup.value === key ? null : key;
  p5CollapsedAgentOpen.value = false;
}

function toggleP5CollapsedAgent() {
  p5CollapsedAgentOpen.value = !p5CollapsedAgentOpen.value;
  p5CollapsedOpenGroup.value = null;
}

const P5MenuStrip = (props: { title: string; subtitle?: string; hot?: string }) => {
  const chars = titleChars(props.title, props.hot);
  const charWidth = 54;
  const gap = 6;
  const titleWidth = chars.length * charWidth + Math.max(0, chars.length - 1) * gap;
  const titleStart = 218 + (5 - chars.length) * 18;
  const subtitleWidth = Math.max(160, (props.subtitle?.length || 0) * 22 + 34);

  return h(
    'svg',
    {
      class: 'p5-menu-strip-svg',
      viewBox: '0 0 760 150',
      'aria-hidden': 'true',
    },
    [
      h('polygon', { points: '72,8 742,8 724,134 34,134 82,76 56,18', fill: '#050505' }),
      h('polyline', { points: '72,8 742,8 724,134 34,134 82,76 56,18 72,8', fill: 'none', stroke: '#fff8ec', 'stroke-width': '4', 'stroke-linejoin': 'miter' }),
      h('polyline', { points: '82,18 728,18 712,124 56,124 96,76 76,30 82,18', fill: 'none', stroke: '#fff8ec', 'stroke-width': '2.5', 'stroke-linejoin': 'miter' }),
      h('g', { class: 'p5-strip-svg-stars' }, [
        h('path', { d: 'M31 18 L37 38 L58 38 L41 50 L48 71 L31 58 L14 71 L21 50 L4 38 L25 38 Z', fill: '#d6001c', stroke: '#fff8ec', 'stroke-width': '5', transform: 'translate(8 18) rotate(-12 31 44)' }),
        h('path', { d: 'M21.5 0 L26.3 15 L42 15 L29.3 24 L34.1 39 L21.5 30 L8.9 39 L13.7 24 L1 15 L16.7 15 Z', fill: '#050505', stroke: '#fff8ec', 'stroke-width': '4', transform: 'translate(48 35) rotate(21 21.5 19.5)' }),
        h('path', { d: 'M21.5 0 L26.3 15 L42 15 L29.3 24 L34.1 39 L21.5 30 L8.9 39 L13.7 24 L1 15 L16.7 15 Z', fill: '#fff8ec', transform: 'translate(58 45) scale(.55) rotate(29 21.5 19.5)' }),
        h('path', { d: 'M8 0 L10 5 L16 5 L11 9 L13 15 L8 11 L3 15 L5 9 L0 5 L6 5 Z', fill: '#d6001c', transform: 'translate(0 73) rotate(-26 8 8)' }),
        h('path', { d: 'M8.5 0 L10.5 5.5 L17 5.5 L11.8 9.5 L13.8 16 L8.5 12 L3.2 16 L5.2 9.5 L0 5.5 L6.5 5.5 Z', fill: '#fff8ec', stroke: '#050505', 'stroke-width': '3', transform: 'translate(63 5) rotate(15 8.5 8)' }),
        h('path', { d: 'M6 0 L7.4 4 L12 4 L8.3 6.8 L9.8 11.5 L6 8.7 L2.2 11.5 L3.7 6.8 L0 4 L4.6 4 Z', fill: '#fff8ec', stroke: '#050505', 'stroke-width': '2', opacity: '.86', transform: 'translate(32 2) rotate(-8 6 6)' }),
      ]),
      h('polyline', { points: '5 14 126 7 96 39', fill: 'none', stroke: '#fff8ec', 'stroke-width': '4', 'stroke-linecap': 'square', 'stroke-linejoin': 'miter', transform: 'translate(594 18)' }),
      h('polyline', { points: '0 30 112 18 92 30 300 12', fill: 'none', stroke: '#d6001c', 'stroke-width': '7', 'stroke-linecap': 'square', 'stroke-linejoin': 'miter', transform: 'translate(80 87)' }),
      h('g', { transform: `translate(${titleStart} 27) rotate(-2)` }, [
        h('g', { transform: 'skewX(-8)' }, chars.map((part, index) => h('rect', {
          x: index * (charWidth + gap),
          y: 0,
          width: charWidth,
          height: 58,
          fill: part.hot ? '#d6001c' : '#050505',
          stroke: '#fff8ec',
          'stroke-width': '3',
        }))),
        ...chars.map((part, index) => h('text', {
          class: 'p5-menu-strip-char',
          x: index * (charWidth + gap) + charWidth / 2,
          y: 31,
          transform: 'skewX(-8)',
          fill: '#fff8ec',
          stroke: '#050505',
          'stroke-width': '7',
          'paint-order': 'stroke',
          'stroke-linejoin': 'round',
          'dominant-baseline': 'central',
          'text-anchor': 'middle',
        }, part.text)),
        props.subtitle ? h('g', { transform: `translate(${Math.max(96, titleWidth * 0.33)} 64)` }, [
          h('polygon', { points: `-6 0 ${subtitleWidth} -8 ${subtitleWidth + 8} 28 2 31`, fill: 'rgba(0,0,0,.86)', stroke: 'rgba(255,255,255,.7)', 'stroke-width': '2' }),
          h('text', { class: 'p5-menu-strip-subtitle', x: 14, y: 20 }, props.subtitle),
        ]) : null,
      ]),
    ],
  );
};

const person5GroupLabels: Record<SidebarGroupKey, string> = {
  Conversation: "作战会议室",
  Agent: "心之怪盗团",
  Monitoring: "潜入记录",
  Tools: "黑匣终端",
  System: "系统面板",
};

const person5GroupMeta: Record<SidebarGroupKey, { subtitle: string; hot?: string }> = {
  Conversation: { subtitle: "作战 / 潜入" },
  Agent: { subtitle: "成员 / 侧写", hot: "心" },
  Monitoring: { subtitle: "会话 / 档案", hot: "入" },
  Tools: { subtitle: "终端 / 黑箱", hot: "黑" },
  System: { subtitle: "控制 / 状态" },
};

const person5ControlMeta: Record<Person5ControlKey, { title: string; subtitle: string; hot?: string }> = {
  profile: { title: "人格面具", subtitle: "Persona / 侧写", hot: "面" },
  model: { title: "模型中枢", subtitle: "Model / 调度" },
};

const p5ControlCollapsed = ref<Record<Person5ControlKey, boolean>>({
  profile: true,
  model: true,
});
const p5AgentSubmenuRef = ref<HTMLElement | null>(null);
const p5ProfileSubmenuRef = ref<HTMLElement | null>(null);
const p5ModelSubmenuRef = ref<HTMLElement | null>(null);
const p5ProfileActionsOpen = ref<Record<string, boolean>>({});
const p5ProfileRestarting = ref<Record<string, boolean>>({});
const p5GatewayRestarting = ref<Record<string, boolean>>({});
const p5AvatarSaving = ref<Record<string, boolean>>({});
const p5AvatarProfileName = ref<string | null>(null);
const p5AvatarInputRef = ref<HTMLInputElement | null>(null);

const activeProfileName = computed(() => profilesStore.activeProfileName || "default");
const activeProfileModels = computed(() => {
  const profileModels = appStore.profileModelGroups.find(entry => entry.profile === activeProfileName.value);
  return profileModels?.groups || appStore.modelGroups || [];
});
const p5ModelItems = computed(() => activeProfileModels.value.flatMap(group => {
  const models = [
    ...group.models,
    ...(appStore.customModels[group.provider] || []).filter(model => !group.models.includes(model)),
  ];
  return models.map(model => ({
    provider: group.provider,
    providerLabel: group.label,
    model,
    label: appStore.displayModelName(model, group.provider),
  }));
}));
function groupLabel(key: SidebarGroupKey) {
  if (isPerson5.value) {
    return person5GroupLabels[key];
  }
  return t(`sidebar.group${key}${appStore.sidebarCollapsed ? "Short" : ""}`);
}

function groupSubtitle(key: SidebarGroupKey) {
  return person5GroupMeta[key].subtitle;
}

function groupTitleChars(key: SidebarGroupKey) {
  const title = person5GroupLabels[key];
  const hot = person5GroupMeta[key].hot;
  return titleChars(title, hot);
}

function titleChars(title: string, hot?: string) {
  if (!hot) return Array.from(title).map((text) => ({ text, hot: false }));
  const index = title.indexOf(hot);
  if (index < 0) return Array.from(title).map((text) => ({ text, hot: false }));
  return Array.from(title).map((text, charIndex) => ({
    text,
    hot: charIndex >= index && charIndex < index + hot.length,
  }));
}

function toggleGroup(key: string) {
  collapsedGroups[key] = !isGroupCollapsed(key);
  persistCollapsedGroups();
}

function shouldShowCollapsedItem(item: P5CollapsedIconItem) {
  if (item.superAdminOnly && !isSuperAdmin.value) return false;
  if (item.routeName && !hasRoute(item.routeName)) return false;
  if (item.hidden?.()) return false;
  return true;
}

function isCollapsedItemActive(item: P5CollapsedIconItem) {
  if (!item.routeName) return false;
  if (item.routeName === "hermes.chat") return isNavActive("hermes.chat", "hermes.session");
  if (item.routeName === "hermes.history") return isNavActive("hermes.history", "hermes.historySession");
  if (item.routeName === "hermes.groupChat") return isNavActive("hermes.groupChat", "hermes.groupChatRoom");
  return selectedKey.value === item.routeName;
}

function handleCollapsedAction(item: P5CollapsedIconItem) {
  item.action?.();
}

function isGroupCollapsed(key: string) {
  if (isPerson5.value && collapsedGroups[key] === undefined) {
    return true;
  }
  return !!collapsedGroups[key];
}

function toggleP5Control(key: Person5ControlKey) {
  p5ControlCollapsed.value[key] = !p5ControlCollapsed.value[key];
}

function isP5ControlCollapsed(key: Person5ControlKey) {
  return p5ControlCollapsed.value[key];
}

function scrollP5Submenu(key: Person5ControlKey) {
  const el = key === "profile" ? p5ProfileSubmenuRef.value : p5ModelSubmenuRef.value;
  if (!el) return;
  const firstItem = el.querySelector<HTMLElement>(".nav-item");
  const itemHeight = firstItem?.offsetHeight || 64;
  el.scrollBy({
    top: itemHeight * 4,
    behavior: "smooth",
  });
}

function scrollP5AgentSubmenu() {
  const el = p5AgentSubmenuRef.value;
  if (!el) return;
  const firstItem = el.querySelector<HTMLElement>(".nav-item");
  const itemHeight = firstItem?.offsetHeight || 64;
  el.scrollBy({
    top: itemHeight * 4,
    behavior: "smooth",
  });
}

function isP5ProfileActionsOpen(name: string) {
  return !!p5ProfileActionsOpen.value[name];
}

function toggleP5ProfileActions(name: string) {
  p5ProfileActionsOpen.value = {
    [name]: !p5ProfileActionsOpen.value[name],
  };
}

async function handleP5ProfileSwitch(name: string) {
  if (name === activeProfileName.value) return;
  const ok = await profilesStore.switchProfile(name);
  if (ok) {
    message.success(`人格面具已切换：${name}`);
    window.location.reload();
  } else {
    message.error("人格面具切换失败");
  }
}

function handleP5ChooseAvatar(name: string) {
  p5AvatarProfileName.value = name;
  p5AvatarInputRef.value?.click();
}

async function handleP5AvatarFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  const name = p5AvatarProfileName.value;
  if (!file || !name) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    message.warning(t("profiles.avatar.invalidType"));
    return;
  }
  if (file.size > 1024 * 1024) {
    message.warning(t("profiles.avatar.tooLarge"));
    return;
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
  p5AvatarSaving.value = { ...p5AvatarSaving.value, [name]: true };
  try {
    await profilesStore.updateAvatar(name, { type: "image", dataUrl });
    message.success(t("profiles.avatar.saveSuccess"));
  } catch (err: any) {
    message.error(err?.message || t("profiles.avatar.saveFailed"));
  } finally {
    p5AvatarSaving.value = { ...p5AvatarSaving.value, [name]: false };
    p5AvatarProfileName.value = null;
  }
}

async function handleP5RestartProfile(name: string) {
  p5ProfileRestarting.value = { ...p5ProfileRestarting.value, [name]: true };
  try {
    await restartProfileRuntime(name);
    message.success(t('profiles.runtime.profileRestarted', { name }));
  } catch (err: any) {
    message.error(err?.message || t('profiles.runtime.profileRestartFailed'));
  } finally {
    p5ProfileRestarting.value = { ...p5ProfileRestarting.value, [name]: false };
  }
}

async function handleP5RestartGateway(name: string) {
  p5GatewayRestarting.value = { ...p5GatewayRestarting.value, [name]: true };
  try {
    await restartProfileGateway(name);
    message.success(t('profiles.runtime.gatewayRestarted', { name }));
  } catch (err: any) {
    message.error(err?.message || t('profiles.runtime.gatewayRestartFailed'));
  } finally {
    p5GatewayRestarting.value = { ...p5GatewayRestarting.value, [name]: false };
  }
}

async function handleP5ModelSwitch(model: string, provider: string) {
  if (model === appStore.selectedModel && provider === appStore.selectedProvider) return;
  await appStore.switchModel(model, provider);
  message.success(`模型已切换：${appStore.displayModelName(model, provider)}`);
}


async function handleUpdate() {
  const ok = await appStore.doUpdate();
  if (ok) {
    message.success(t('sidebar.updateSuccess'), { duration: 5000 });
  } else {
    message.error(t('sidebar.updateFailed'));
  }
}

function handleReloadClient() {
  appStore.reloadClient();
}

function handleLogout() {
  clearApiKey();
  router.replace({ name: 'login' });
}

// Changelog
const showChangelog = ref(false);

function openChangelog() {
  showChangelog.value = true;
}

onMounted(() => {
  if (profilesStore.profiles.length === 0) {
    void profilesStore.fetchProfiles();
  }
  void appStore.loadModels();
});
</script>

<template>
  <aside class="sidebar" :class="{ open: appStore.sidebarOpen, collapsed: appStore.sidebarCollapsed }">
    <div v-if="isPerson5" class="p5-sidebar-title">
      {{ appStore.sidebarCollapsed ? 'MENU' : 'COMMAND MENU' }}
    </div>
    <RouteLinkItem class="sidebar-logo" :to="{ name: 'hermes.chat' }">
      <img :src="logoPath" alt="Hermes Studio" class="logo-img" />
      <span class="logo-copy">
        <span class="p5-logo-title">卢布朗咖啡店</span>
        <span class="logo-text">Hermes Studio</span>
        <span class="p5-logo-subtitle">CAFÉ LEBLANC / HERMES STUDIO</span>
      </span>
      <!-- <video class="logo-dance" :src="isDark ? danceVideoDark : danceVideoLight" autoplay loop muted playsinline /> -->
    </RouteLinkItem>

    <button class="collapse-btn" @click="appStore.toggleSidebarCollapsed()" :title="appStore.sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline v-if="appStore.sidebarCollapsed" points="9 18 15 12 9 6" />
        <polyline v-else points="15 18 9 12 15 6" />
      </svg>
    </button>

    <div v-if="isPerson5 && appStore.sidebarCollapsed" class="p5-collapsed-rail" aria-label="PERSON5 collapsed menu">
      <div
        v-for="group in p5CollapsedGroups"
        :key="group.key"
        class="p5-collapsed-stack"
        :class="{ open: p5CollapsedOpenGroup === group.key }"
      >
        <button
          class="p5-collapsed-tab"
          :class="{ active: group.active() }"
          type="button"
          @click.stop.prevent="toggleP5CollapsedGroup(group.key)"
        >
          <span>{{ group.label }}</span>
        </button>
        <div v-if="p5CollapsedOpenGroup === group.key" class="p5-collapsed-icons">
          <template
            v-for="item in p5CollapsedItems[group.key]"
            :key="item.key"
          >
            <RouteLinkItem
              v-if="item.routeName && shouldShowCollapsedItem(item)"
              class="p5-collapsed-icon"
              :to="{ name: item.routeName }"
              :active="isCollapsedItemActive(item)"
              :title="item.label"
            >
              <P5CollapsedIcon :name="item.icon" />
            </RouteLinkItem>
            <button
              v-else-if="shouldShowCollapsedItem(item)"
              class="p5-collapsed-icon"
              type="button"
              :title="item.label"
              @click="handleCollapsedAction(item)"
            >
              <P5CollapsedIcon :name="item.icon" />
            </button>
          </template>
        </div>
      </div>
      <div class="p5-collapsed-agent" :class="{ open: p5CollapsedAgentOpen }">
        <button
          class="p5-collapsed-agent-button"
          type="button"
          :title="activeProfileName"
          @click.stop.prevent="toggleP5CollapsedAgent"
        >
          <ProfileAvatarView
            :name="activeProfileName"
            :avatar="profilesStore.activeProfile?.avatar"
            :size="42"
          />
        </button>
        <div v-if="p5CollapsedAgentOpen" class="p5-collapsed-agent-actions">
          <button class="p5-collapsed-icon" type="button" title="选择头像" @click.stop="handleP5ChooseAvatar(activeProfileName)">
            <P5CollapsedIcon name="image" />
          </button>
          <button class="p5-collapsed-icon" type="button" title="选择配置" @click.stop="handleP5ProfileSwitch(activeProfileName)">
            <P5CollapsedIcon name="user" />
          </button>
          <button class="p5-collapsed-icon" type="button" title="重启配置" @click.stop="handleP5RestartProfile(activeProfileName)">
            <P5CollapsedIcon name="refresh" />
          </button>
          <button class="p5-collapsed-icon" type="button" title="重启网关" @click.stop="handleP5RestartGateway(activeProfileName)">
            <P5CollapsedIcon name="server" />
          </button>
        </div>
      </div>
      <div class="p5-collapsed-quick-actions">
        <ThemeSwitch />
        <button class="p5-collapsed-icon" type="button" :title="t('sidebar.logout')" @click="handleLogout">
          <P5CollapsedIcon name="logout" />
        </button>
      </div>
    </div>

    <nav class="sidebar-nav">
      <!-- Conversation -->
      <div class="nav-group nav-group-conversation" :class="{ expanded: !isGroupCollapsed('conversation') }">
        <div class="nav-group-label" @click="toggleGroup('conversation')">
          <template v-if="isPerson5">
            <span class="p5-hero-card-media" aria-hidden="true"></span>
            <span class="p5-menu-stars" aria-hidden="true"></span>
            <span class="p5-notch-stars" aria-hidden="true">
              <span class="p5-star p5-star-red p5-star-large"></span>
              <span class="p5-star p5-star-white p5-star-large"></span>
              <span class="p5-star p5-star-red p5-star-small"></span>
              <span class="p5-star p5-star-white p5-star-small"></span>
            </span>
            <span class="p5-z-stripe" aria-hidden="true"></span>
            <span class="p5-seven-stripe" aria-hidden="true"></span>
            <span class="p5-menu-copy">
              <span class="p5-menu-full">{{ groupLabel("Conversation") }}</span>
              <span class="p5-menu-title">
                <span
                  v-for="(part, index) in groupTitleChars('Conversation')"
                  :key="`conversation-${part.text}-${index}`"
                  class="p5-menu-char"
                  :class="{ 'p5-menu-hot': part.hot }"
                >
                  {{ part.text }}
                </span>
              </span>
              <span class="p5-menu-subtitle">{{ groupSubtitle("Conversation") }}</span>
            </span>
            <span class="p5-menu-gear" aria-hidden="true"></span>
          </template>
          <span v-else>{{ groupLabel("Conversation") }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('conversation') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div class="nav-group-items" :class="{ collapsed: isGroupCollapsed('conversation') }">
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.chat' }" :active="isNavActive('hermes.chat', 'hermes.session')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{{ t("sidebar.chat") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.history' }" :active="isNavActive('hermes.history', 'hermes.historySession')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{{ t("sidebar.history") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.groupChat' }" :active="isNavActive('hermes.groupChat', 'hermes.groupChatRoom')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>{{ t("sidebar.groupChat") }}<span class="beta-tag">(beta)</span></span>
          </RouteLinkItem>
          <button class="nav-item" @click="openSessionSearch">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span>{{ t("sidebar.search") }}</span>
          </button>
        </div>
      </div>

      <!-- Agent -->
      <div class="nav-group nav-group-agent" :class="{ expanded: !isGroupCollapsed('agent') }">
        <div class="nav-group-label" @click="toggleGroup('agent')">
          <template v-if="isPerson5">
            <P5MenuStrip :title="groupLabel('Agent')" :subtitle="groupSubtitle('Agent')" :hot="person5GroupMeta.Agent.hot" />
          </template>
          <span v-else>{{ groupLabel("Agent") }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('agent') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div ref="p5AgentSubmenuRef" class="nav-group-items p5-limited-submenu" :class="{ collapsed: isGroupCollapsed('agent') }">
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.jobs' }" :active="selectedKey === 'hermes.jobs'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{{ t("sidebar.jobs") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.kanban' }" :active="selectedKey === 'hermes.kanban'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="5" height="18" rx="1" />
            </svg>
            <span>{{ t("sidebar.kanban") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.channels' }" :active="selectedKey === 'hermes.channels'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            <span>{{ t("sidebar.channels") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.skills' }" :active="selectedKey === 'hermes.skills'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>{{ t("sidebar.skills") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.plugins' }" :active="selectedKey === 'hermes.plugins'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2.1-2.1a4 4 0 0 1-5.3 5.3l-7.8 7.8a2.1 2.1 0 0 1-3-3l7.8-7.8a4 4 0 0 1 5.3-5.3l-2.1 2.1z" />
              <path d="M5 19l1-1" />
            </svg>
            <span>{{ t("sidebar.plugins") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.mcp' }" :active="selectedKey === 'hermes.mcp'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 7V4h16v3" />
              <path d="M9 20h6" />
              <path d="M12 7v13" />
              <rect x="4" y="7" width="16" height="7" rx="2" />
            </svg>
            <span>{{ t("sidebar.mcp") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.memory' }" :active="selectedKey === 'hermes.memory'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
            </svg>
            <span>{{ t("sidebar.memory") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.models' }" :active="selectedKey === 'hermes.models'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
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
          </RouteLinkItem>
        </div>
        <button
          v-if="isPerson5 && !isGroupCollapsed('agent')"
          class="p5-submenu-more p5-nav-submenu-more"
          type="button"
          @click.stop="scrollP5AgentSubmenu"
        >
          更多 ↓
        </button>
      </div>

      <!-- Monitoring -->
      <div class="nav-group nav-group-monitoring" :class="{ expanded: !isGroupCollapsed('monitoring') }">
        <div class="nav-group-label p5-strip-shift" @click="toggleGroup('monitoring')">
          <template v-if="isPerson5">
            <P5MenuStrip :title="groupLabel('Monitoring')" :subtitle="groupSubtitle('Monitoring')" :hot="person5GroupMeta.Monitoring.hot" />
          </template>
          <span v-else>{{ groupLabel("Monitoring") }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('monitoring') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div class="nav-group-items" :class="{ collapsed: isGroupCollapsed('monitoring') }">
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.logs' }" :active="selectedKey === 'hermes.logs'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>{{ t("sidebar.logs") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.usage' }" :active="selectedKey === 'hermes.usage'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="12" width="4" height="9" rx="1" />
              <rect x="10" y="7" width="4" height="14" rx="1" />
              <rect x="17" y="3" width="4" height="18" rx="1" />
            </svg>
            <span>{{ t("sidebar.usage") }}</span>
          </RouteLinkItem>
          <RouteLinkItem v-if="isSuperAdmin" class="nav-item" :to="{ name: 'hermes.performance' }" :active="selectedKey === 'hermes.performance'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            <span>{{ t("sidebar.performance") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.skillsUsage' }" :active="selectedKey === 'hermes.skillsUsage'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8.11 2.79" />
              <path d="M22 12A10 10 0 0 0 12 2v10z" />
            </svg>
            <span>{{ t("sidebar.skillsUsage") }}</span>
          </RouteLinkItem>
        </div>
      </div>

      <!-- Tools -->
      <div class="nav-group nav-group-tools" :class="{ expanded: !isGroupCollapsed('tools') }">
        <div class="nav-group-label" @click="toggleGroup('tools')">
          <template v-if="isPerson5">
            <P5MenuStrip :title="groupLabel('Tools')" :subtitle="groupSubtitle('Tools')" :hot="person5GroupMeta.Tools.hot" />
          </template>
          <span v-else>{{ groupLabel("Tools") }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('tools') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div class="nav-group-items" :class="{ collapsed: isGroupCollapsed('tools') }">
          <RouteLinkItem v-if="hasRoute('hermes.codingAgents')" class="nav-item" :to="{ name: 'hermes.codingAgents' }" :active="selectedKey === 'hermes.codingAgents'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
              <line x1="12" y1="20" x2="14" y2="4" />
            </svg>
            <span>{{ t("sidebar.codingAgents") }}</span>
          </RouteLinkItem>
          <RouteLinkItem v-if="hasRoute('hermes.versionPreview') && isSuperAdmin && !isVersionPreview" class="nav-item" :to="{ name: 'hermes.versionPreview' }" :active="selectedKey === 'hermes.versionPreview'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
              <polyline points="7.5 19.79 7.5 14.6 3 12" />
              <polyline points="21 12 16.5 14.6 16.5 19.79" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>{{ t("sidebar.versionPreview") }}</span>
          </RouteLinkItem>
        </div>
      </div>

      <!-- System -->
      <div class="nav-group nav-group-system" :class="{ expanded: !isGroupCollapsed('system') }">
        <div class="nav-group-label p5-strip-shift" @click="toggleGroup('system')">
          <template v-if="isPerson5">
            <P5MenuStrip :title="groupLabel('System')" :subtitle="groupSubtitle('System')" :hot="person5GroupMeta.System.hot" />
          </template>
          <span v-else>{{ groupLabel("System") }}</span>
          <svg class="nav-group-arrow" :class="{ collapsed: isGroupCollapsed('system') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div class="nav-group-items" :class="{ collapsed: isGroupCollapsed('system') }">
          <RouteLinkItem v-if="isSuperAdmin" class="nav-item" :to="{ name: 'hermes.profiles' }" :active="selectedKey === 'hermes.profiles'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>{{ t("sidebar.profiles") }}</span>
          </RouteLinkItem>
          <RouteLinkItem class="nav-item" :to="{ name: 'hermes.settings' }" :active="selectedKey === 'hermes.settings'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>{{ t("sidebar.settings") }}</span>
          </RouteLinkItem>
        </div>
      </div>
    </nav>

    <div class="p5-sidebar-controls" :class="{ 'is-person5': isPerson5 }">
      <template v-if="isPerson5">
        <div class="nav-group p5-control-group p5-control-profile" :class="{ expanded: !isP5ControlCollapsed('profile') }">
          <button class="nav-group-label p5-control-label-main" type="button" @click="toggleP5Control('profile')">
            <P5MenuStrip :title="person5ControlMeta.profile.title" :subtitle="person5ControlMeta.profile.subtitle" :hot="person5ControlMeta.profile.hot" />
            <svg class="nav-group-arrow" :class="{ collapsed: isP5ControlCollapsed('profile') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div ref="p5ProfileSubmenuRef" class="nav-group-items p5-submenu-scroll" :class="{ collapsed: isP5ControlCollapsed('profile') }">
            <div
              v-for="profile in profilesStore.profiles"
              :key="profile.name"
              class="p5-profile-row"
            >
              <button
                class="nav-item p5-profile-item"
                :class="{ active: profile.name === activeProfileName }"
                type="button"
                @click="toggleP5ProfileActions(profile.name)"
              >
                <ProfileAvatarView :name="profile.name" :avatar="profile.avatar" :size="38" />
                <span class="p5-submenu-main">{{ profile.name }}</span>
              </button>
              <div v-if="isP5ProfileActionsOpen(profile.name)" class="p5-profile-actions">
                <button
                  class="p5-profile-action"
                  type="button"
                  :disabled="p5AvatarSaving[profile.name]"
                  @click.stop="handleP5ChooseAvatar(profile.name)"
                >
                  选择头像
                </button>
                <button
                  class="p5-profile-action"
                  type="button"
                  :disabled="profile.name === activeProfileName"
                  @click.stop="handleP5ProfileSwitch(profile.name)"
                >
                  选择配置
                </button>
                <button
                  class="p5-profile-action"
                  type="button"
                  :disabled="p5ProfileRestarting[profile.name]"
                  @click.stop="handleP5RestartProfile(profile.name)"
                >
                  重启配置
                </button>
                <button
                  class="p5-profile-action"
                  type="button"
                  :disabled="p5GatewayRestarting[profile.name]"
                  @click.stop="handleP5RestartGateway(profile.name)"
                >
                  重启网关
                </button>
              </div>
            </div>
          </div>
          <input
            ref="p5AvatarInputRef"
            class="p5-avatar-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            @change="handleP5AvatarFileChange"
          >
          <button
            v-if="profilesStore.profiles.length > 4 && !isP5ControlCollapsed('profile')"
            class="p5-submenu-more"
            type="button"
            @click.stop="scrollP5Submenu('profile')"
          >
            更多人格面具 ↓
          </button>
        </div>

        <div class="nav-group p5-control-group p5-control-model" :class="{ expanded: !isP5ControlCollapsed('model') }">
          <button class="nav-group-label p5-control-label-main p5-strip-shift" type="button" @click="toggleP5Control('model')">
            <P5MenuStrip :title="person5ControlMeta.model.title" :subtitle="person5ControlMeta.model.subtitle" :hot="person5ControlMeta.model.hot" />
            <svg class="nav-group-arrow" :class="{ collapsed: isP5ControlCollapsed('model') }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div ref="p5ModelSubmenuRef" class="nav-group-items p5-submenu-scroll" :class="{ collapsed: isP5ControlCollapsed('model') }">
            <button
              v-for="item in p5ModelItems"
              :key="`${item.provider}:${item.model}`"
              class="nav-item p5-model-item"
              :class="{ active: item.model === appStore.selectedModel && item.provider === appStore.selectedProvider }"
              type="button"
              :title="`${item.providerLabel} / ${item.label} (${item.model})`"
              @click="handleP5ModelSwitch(item.model, item.provider)"
            >
              <span class="p5-model-mark">M</span>
              <span class="p5-submenu-main">{{ item.label }}</span>
              <span class="p5-submenu-sub">{{ item.providerLabel }}</span>
            </button>
          </div>
          <button
            v-if="p5ModelItems.length > 4 && !isP5ControlCollapsed('model')"
            class="p5-submenu-more"
            type="button"
            @click.stop="scrollP5Submenu('model')"
          >
            更多模型 ↓
          </button>
        </div>
      </template>
      <template v-else>
        <div class="p5-control-strip p5-control-profile">
          <span class="p5-control-label">人格面具</span>
          <ProfileSelector />
        </div>
        <div class="p5-control-strip p5-control-model">
          <span class="p5-control-label">模型中枢</span>
          <ModelSelector />
        </div>
      </template>
    </div>

    <div class="sidebar-footer">
      <button class="nav-item logout-item" :class="{ 'p5-logout-strip': isPerson5 }" @click="handleLogout">
        <P5MenuStrip v-if="isPerson5" :title="t('sidebar.logout')" />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span>{{ t("sidebar.logout") }}</span>
      </button>
      <div class="status-row" :class="isPerson5 ? ['p5-utility-card', 'p5-language-card'] : []">
        <P5MenuStrip v-if="isPerson5" title="" />
        <div
          v-if="!isPerson5"
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
      <div class="version-info" :class="isPerson5 ? ['p5-utility-card', 'p5-repo-card'] : []">
        <P5MenuStrip v-if="isPerson5" title="" />
        <div class="version-links">
          <a class="github-link" href="https://github.com/ifsherlock/hermes-web-ui" target="_blank" rel="noopener noreferrer" title="GitHub">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            <span v-if="isPerson5" class="p5-footer-link-label">仓库</span>
          </a>
          <a class="website-link" href="https://hermes-studio.ai/" target="_blank" rel="noopener noreferrer" title="Website">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span v-if="isPerson5" class="p5-footer-link-label">主页</span>
          </a>
        </div>
        <span class="version-text" @click="openChangelog">Studio v{{ appStore.serverVersion || "0.1.0" }}</span>
        <ThemeSwitch />
      </div>
      <NButton v-if="appStore.clientOutdated" type="warning" size="tiny" block class="update-btn" @click="handleReloadClient">
        {{ t('sidebar.reloadClientVersion', { version: appStore.serverVersion }) }}
      </NButton>
      <NButton v-if="appStore.updateAvailable" type="primary" size="tiny" block class="update-btn" :loading="appStore.updating" @click="handleUpdate">
        {{ appStore.updating ? t('sidebar.updating') : t('sidebar.updateVersion', { version: appStore.latestVersion }) }}
      </NButton>
    </div>

    <!-- Changelog modal -->
    <NModal
      v-model:show="showChangelog"
      preset="dialog"
      :title="t('sidebar.changelog')"
      class="changelog-modal"
      title-class="changelog-dialog-title"
      content-class="changelog-dialog-content"
      style="width: 520px;"
    >
      <div class="changelog-list">
        <div v-for="entry in changelog" :key="entry.version" class="changelog-version-block">
          <div class="changelog-version-header">
            <span class="changelog-version-tag">v{{ entry.version }}</span>
            <span class="changelog-date">{{ entry.date }}</span>
          </div>
          <ul class="changelog-changes">
            <li v-for="(change, idx) in entry.changes" :key="idx">{{ t(change) }}</li>
          </ul>
        </div>
      </div>
    </NModal>
  </aside>
</template>

<style scoped lang="scss">
@use "@/styles/variables" as *;

.sidebar {
  position: relative;
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
  background-color: $bg-card;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  .dark & {
    background-color: #393939;
  }
  position: relative;
  overflow: hidden;

  .logo-text {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
    white-space: nowrap;
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
    pointer-events: none;
  }
}

.sidebar-nav {
  flex: 1;
  display: flex;
  padding-top: 12px;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  min-height: 0;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

:deep(.profile-selector) {
  padding-top: 12px;
  border-top: 1px solid $border-color;
}

.p5-sidebar-controls {
  display: contents;
}

.p5-control-label {
  display: none;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &.nav-group-bottom {
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid $border-color;
  }
}

.nav-group-items {
  display: flex;
  flex-direction: column;
  gap: 2px;

  &.collapsed {
    display: none;
  }
}

.nav-group-label {
  font-size: 10px;
  font-weight: 600;
  color: $text-muted;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  padding: 8px 12px 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
  border-radius: $radius-sm;
  transition: color $transition-fast;

  &:hover {
    color: $text-secondary;
  }

  .nav-group:first-child & {
    padding-top: 0;
  }
}

.nav-group-arrow {
  transition: transform $transition-fast;
  flex-shrink: 0;

  &.collapsed {
    transform: rotate(-90deg);
  }
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: none;
  background: none;
  appearance: none;
  text-decoration: none;
  color: $text-secondary;
  font-size: 14px;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $transition-fast;
  width: 100%;
  text-align: left;

  &:hover {
    background-color: rgba(var(--accent-primary-rgb), 0.06);
    color: $text-primary;
  }

  &.active {
    background-color: rgba(var(--accent-primary-rgb), 0.12);
    color: $accent-primary;
  }

  .beta-tag {
    font-size: 10px;
    color: $text-muted;
    margin-left: 2px;
  }
}

.sidebar-footer {
  padding-top: 8px;
  border-top: 1px solid $border-color;
}

.logout-item {
  margin: 0 -12px;
  padding: 10px 12px;
  border-radius: 0;
  font-size: 13px;
  color: $text-muted;

  &:hover {
    color: $error;
    background: rgba(var(--error-rgb, 239, 68, 68), 0.06);
  }
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
    box-shadow: 0 0 6px rgba(var(--success-rgb), 0.5);
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
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  overflow: hidden;
}

.version-links {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
}

:deep(.theme-switch-container) {
  flex-shrink: 0;
}

.github-link,
.website-link {
  color: $text-muted;
  display: flex;
  align-items: center;
  transition: color 0.2s;

  &:hover {
    color: $text-primary;
  }
}

.update-btn {
  margin: 4px 0 0;
  border-radius: 4px;
}

.version-text {
  flex: 0 0 auto;
  overflow: visible;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s;

  &:hover {
    color: $accent-primary;
  }
}

.changelog-list {
  max-height: 400px;
  overflow-y: auto;
}

.changelog-version-block {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.changelog-version-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.changelog-version-tag {
  font-weight: 600;
  font-size: 14px;
  color: $text-primary;
  font-family: $font-code;
}

.changelog-changes {
  list-style: none;
  padding: 0;
  margin: 0;

  li {
    font-size: 13px;
    color: $text-secondary;
    padding: 4px 0 4px 16px;
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 12px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: $text-muted;
    }
  }
}

// ─── Collapsed sidebar (icon-rail mode) ─────────────────────────

.sidebar.collapsed {
  width: $sidebar-collapsed-width;
  padding: 0 8px 12px;
  overflow: hidden;

  .sidebar-logo {
    padding: 12px 4px 8px;
    margin: 0 -8px;
    justify-content: center;
    gap: 0;

    .logo-text {
      display: none;
    }
  }

  .collapse-btn {
    display: flex;
    margin: 0 auto 8px;
  }

  .nav-group-label {
    justify-content: center;
    gap: 2px;
    padding: 8px 0 4px;
    letter-spacing: 0;

    span {
      max-width: 36px;
      overflow: hidden;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .nav-item {
    justify-content: center;
    padding: 10px 4px;
    gap: 0;

    span {
      display: none;
    }

    svg {
      flex-shrink: 0;
    }
  }

  // Hide model selector in icon-rail mode, but keep the active profile avatar
  // visible as the profile manager entry point.
  :deep(.model-selector) {
    display: none;
  }

  :deep(.profile-selector) {
    display: flex;
    justify-content: center;
    padding: 8px 0;
    margin: 0 0 6px;
    border-top: 1px solid $border-color;
  }

  :deep(.profile-selector .selector-label),
  :deep(.profile-selector .profile-name) {
    display: none;
  }

  :deep(.profile-selector .profile-display) {
    width: 36px;
    height: 36px;
    justify-content: center;
    padding: 0;
    gap: 0;
    border: none;
    border-radius: 0;
    background: transparent;
  }

  :deep(.profile-selector .profile-display:hover) {
    background: transparent;
  }

  :deep(.profile-selector .profile-avatar) {
    width: 28px !important;
    height: 28px !important;
    flex-basis: 28px !important;
  }

  .sidebar-footer {
    .logout-item {
      margin: 0;
      padding: 10px 4px;
      border-radius: $radius-sm;
    }

    .logout-item span {
      display: none;
    }

    .status-text {
      display: none;
    }

    .version-text,
    .version-links {
      display: none;
    }

    .status-row {
      justify-content: center;

      :deep(.input-sm) {
        display: none;
      }
    }

    .version-info {
      justify-content: center;
      padding: 4px 0;

      :deep(.theme-switch-container) {
        flex-direction: column;
      }
    }
  }
}

// ─── Collapse button ────────────────────────────────────────────

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  appearance: none;
  text-decoration: none;
  color: $text-muted;
  border-radius: $radius-sm;
  cursor: pointer;
  flex-shrink: 0;
  margin-left: auto;
  margin-right: 0;
  transition: all $transition-fast;

  &:hover {
    color: $text-primary;
    background-color: rgba(var(--accent-primary-rgb), 0.08);
  }
}

// In expanded mode, overlap the top-right of the logo area
.sidebar:not(.collapsed) .collapse-btn {
  position: absolute;
  top: 18px;
  right: 16px;
  z-index: 5;
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

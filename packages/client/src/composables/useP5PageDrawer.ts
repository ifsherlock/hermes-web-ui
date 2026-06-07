import { computed, ref, type Ref, watch } from 'vue'

type ReadableRef<T> = Ref<T> | Readonly<Ref<T>>

interface UseP5PageDrawerOptions {
  isPerson5: ReadableRef<boolean>
  isDesktop: ReadableRef<boolean>
  sidebarCollapsed: ReadableRef<boolean>
}

export function useP5PageDrawer(options: UseP5PageDrawerOptions) {
  const isActive = computed(() => options.isPerson5.value && options.isDesktop.value)

  function defaultOpen() {
    return isActive.value && options.sidebarCollapsed.value
  }

  const drawerOpen = ref(defaultOpen())

  const reserveDrawerSlot = computed(() => {
    if (!isActive.value) return false
    return drawerOpen.value
  })

  function resetToDefault() {
    drawerOpen.value = defaultOpen()
  }

  function toggleDrawer() {
    drawerOpen.value = !drawerOpen.value
  }

  watch(
    () => options.sidebarCollapsed.value,
    () => resetToDefault(),
  )

  watch(isActive, () => resetToDefault())

  return {
    drawerOpen,
    reserveDrawerSlot,
    toggleDrawer,
  }
}

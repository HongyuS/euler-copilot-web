import { electronProcess, ipcRenderer } from '@/utils/electron';
import { defineStore } from 'pinia';
import { onBeforeUnmount, onMounted, ref } from 'vue';

export const useChangeThemeStore = defineStore(
  'theme',
  () => {
    const theme = ref<'dark' | 'light'>();

    function updateTheme(t: 'dark' | 'light') {
      theme.value = t;
      document.body.setAttribute('theme', theme.value);

      if (ipcRenderer) {
        ipcRenderer.invoke('copilot:theme', {
          theme: theme.value,
          backgroundColor: theme.value === 'dark' ? '#1f2329' : '#ffffff',
        });
      }
    }

    function storageListener(e: StorageEvent) {
      if (e.key === 'copilot_theme') {
        if (!e.newValue) return;
        theme.value = JSON.parse(e.newValue).theme || 'light';
        document.body.setAttribute('theme', theme.value!);
      }
    }

    onMounted(() => {
      if (electronProcess) {
        if (electronProcess.env['EULERCOPILOT_THEME']) {
          theme.value = electronProcess.env['EULERCOPILOT_THEME'];
          document.body.setAttribute('theme', theme.value!);
        }
      } else {
        if (!theme.value) {
          theme.value = 'light';
          document.body.setAttribute('theme', theme.value!);
        }
      }
      window.addEventListener('storage', storageListener);
    });

    onBeforeUnmount(() => {
      window.removeEventListener('storage', storageListener);
    });
    return {
      theme,
      updateTheme,
    };
  },
  {
    persist: {
      key: 'copilot_theme',
      pick: ['theme'],
    },
  },
);

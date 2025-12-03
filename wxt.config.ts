import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Claude Account Switcher',
    description: 'Gmail-style account switcher for Claude.ai',
    permissions: ['cookies', 'storage', 'tabs'],
    host_permissions: ['https://claude.ai/*', 'https://*.claude.ai/*'],
    action: {
      default_popup: 'popup.html',
      default_title: 'Claude Account Switcher',
      default_icon: {
        16: 'assets/icon-16.png',
        32: 'assets/icon-32.png',
        48: 'assets/icon-48.png',
        128: 'assets/icon-128.png',
      },
    },
    icons: {
      16: 'assets/icon-16.png',
      32: 'assets/icon-32.png',
      48: 'assets/icon-48.png',
      128: 'assets/icon-128.png',
    },
  },
});

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
    },
  },
});

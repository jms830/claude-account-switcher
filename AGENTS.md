# AGENTS.md

## Project Overview
WXT-based Chrome extension for Gmail-style account switching on Claude.ai. Uses chrome.cookies API for HttpOnly cookie access.

## Build/Test Commands
- `npm install` - Install dependencies
- `npm run dev` - Dev mode with hot reload (load `.output/chrome-mv3` in chrome://extensions)
- `npm run build` - Production build
- `npm run zip` - Create distributable zip

## Code Style Guidelines
- **Language**: TypeScript with WXT's auto-imports (`defineContentScript`, `defineBackground`)
- **Naming**: camelCase for functions/variables, PascalCase for interfaces, UPPER_SNAKE_CASE for constants
- **DOM**: Use template literals for HTML injection, vanilla JS for DOM manipulation
- **Storage**: Use `chrome.storage.local` for accounts, `chrome.cookies` API for session switching
- **Messaging**: Content script ↔ background via `chrome.runtime.sendMessage/onMessage`
- **IDs/Classes**: Prefix all injected elements with `cas-` (Claude Account Switcher)
- **Error Handling**: Use try/catch with `console.error('[CAS]')` prefix for debugging
- **UI**: Match Claude's dark theme (#1e1e1c background, #f5f4ef text, #c96442 accent)

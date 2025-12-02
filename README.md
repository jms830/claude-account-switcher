# Claude Account Switcher

A userscript that adds Gmail-style **instant** account switching to Claude.ai. Switch between your work and personal accounts with a single click - no re-login required!

## Features

- **Instant switching** - Switch accounts immediately without logging out
- Gmail-style account dropdown menu
- Work/Personal account labels with colored badges
- Customizable avatar colors (20 options)
- Saves session keys for each account
- Clean, native-looking UI that matches Claude's design
- Persistent storage via Tampermonkey

## Installation

1. Install a userscript manager:
   - [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Safari, Edge)
   - [Violentmonkey](https://violentmonkey.github.io/) (Chrome, Firefox)

2. **[Click here to install the script](https://github.com/jms830/claude-account-switcher/raw/main/claude-account-switcher.user.js)** - Tampermonkey will automatically prompt you to install it

3. Navigate to [claude.ai](https://claude.ai) - you'll see a small dropdown indicator on your avatar

## Usage

### Saving Your First Account

1. Log into Claude with your first account (e.g., work)
2. Click on your avatar in the sidebar
3. Click "Save current session"
4. Fill in:
   - **Display Name**: A friendly name (e.g., "Work Account")
   - **Email Address**: Your Google email (for your reference)
   - **Account Type**: Work or Personal
   - **Avatar Color**: Pick a color to distinguish accounts

### Adding Another Account

1. Log out of Claude and log in with your other account (e.g., personal)
2. Click on your avatar
3. Click "Save current session" again
4. Fill in the details for this account

### Switching Between Accounts

1. Click on your avatar
2. Click the account you want to switch to
3. **That's it!** The page reloads and you're instantly signed in as that account

### Managing Accounts

1. Click on your avatar
2. Click "Manage accounts"
3. Click on any account to edit or delete it

## How It Works

Claude uses session cookies (`sessionKey`) for authentication. This script:

1. **Captures** your session key when you save an account
2. **Stores** session keys locally using Tampermonkey's secure storage
3. **Swaps** the session cookie when you switch accounts
4. **Reloads** the page to apply the new session

Both accounts remain valid - you're not logging out, just switching which session is active.

## Privacy & Security

- All data is stored **locally** using Tampermonkey's GM_setValue
- **No data is sent** to any external servers
- Session keys are stored in your browser's userscript storage
- The script only runs on claude.ai
- You can delete accounts anytime, which removes their stored session keys

## Troubleshooting

**Account not switching?**
- Make sure you saved the session while actually logged into that account
- Try clearing your cookies for claude.ai and re-saving both accounts

**Session expired?**
- Sessions can expire over time. Delete the old account entry and save a fresh session

**Menu not appearing?**
- Refresh the page - the script needs to detect the avatar element
- Check that the userscript is enabled in Tampermonkey

## License

MIT License

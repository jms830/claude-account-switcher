export default defineBackground(() => {
  console.log('[CAS] Background script loaded');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SET_SESSION_COOKIE') {
      setSessionCookie(message.sessionKey)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
    
    if (message.type === 'GET_SESSION_COOKIE') {
      getSessionCookie()
        .then((sessionKey) => sendResponse({ success: true, sessionKey }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    }
  });
});

async function setSessionCookie(sessionKey: string): Promise<void> {
  console.log('[CAS] Setting session cookie...');
  
  // Remove existing sessionKey cookie first
  await chrome.cookies.remove({
    url: 'https://claude.ai',
    name: 'sessionKey'
  });
  
  // Set the new sessionKey cookie
  await chrome.cookies.set({
    url: 'https://claude.ai',
    name: 'sessionKey',
    value: sessionKey,
    domain: '.claude.ai',
    path: '/',
    secure: true,
    httpOnly: true,
    sameSite: 'lax'
  });
  
  console.log('[CAS] Session cookie set successfully');
}

async function getSessionCookie(): Promise<string | null> {
  const cookie = await chrome.cookies.get({
    url: 'https://claude.ai',
    name: 'sessionKey'
  });
  return cookie?.value || null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "PING_SERVICE") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch(message.url, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: controller.signal })
      .then(() => {
        clearTimeout(timeout);
        sendResponse({ online: true });
      })
      .catch(() => {
        clearTimeout(timeout);
        // For opaque redirects or CORS blocks, the service may still be up.
        // A TypeError with "Failed to fetch" usually means truly unreachable.
        sendResponse({ online: false });
      });
    return true;
  }

  if (message.type === "GET_GOOGLE_TOKEN") {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ token });
      }
    });
    return true;
  }

  if (message.type === "REVOKE_GOOGLE_TOKEN") {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          fetch("https://accounts.google.com/o/oauth2/revoke?token=" + token);
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (message.type === "GET_OUTLOOK_TOKEN") {
    const clientId = message.clientId;
    const redirectUri = chrome.identity.getRedirectURL();
    const scope = encodeURIComponent(
      "openid profile Calendars.Read offline_access"
    );
    const authUrl =
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize" +
      "?client_id=" + clientId +
      "&response_type=token" +
      "&redirect_uri=" + encodeURIComponent(redirectUri) +
      "&scope=" + scope +
      "&response_mode=fragment";

    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          sendResponse({
            error: chrome.runtime.lastError
              ? chrome.runtime.lastError.message
              : "Auth failed",
          });
          return;
        }
        const url = new URL(responseUrl);
        const hash = url.hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get("access_token");
        if (token) {
          sendResponse({ token });
        } else {
          sendResponse({ error: "No token received" });
        }
      }
    );
    return true;
  }
});

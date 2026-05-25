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
        sendResponse({ online: false });
      });
    return true;
  }
});

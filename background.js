chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ANALYZE_PAGE") {
    return false;
  }

  analyzeTab(message.tabId)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      console.error("Web Design Analyzer background error:", error);
      sendResponse({
        ok: false,
        error: error.message || "No fue posible analizar la pestana."
      });
    });

  return true;
});

async function analyzeTab(tabId) {
  if (typeof tabId !== "number") {
    throw new Error("El identificador de la pestana no es valido.");
  }

  const response = await chrome.tabs.sendMessage(tabId, { type: "RUN_ANALYSIS" });

  if (!response || !response.ok) {
    throw new Error(response?.error || "No hubo respuesta del analizador.");
  }

  return response.data;
}

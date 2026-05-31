chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "RUN_ANALYSIS") {
    return false;
  }

  try {
    const data = analyzePage();
    sendResponse({ ok: true, data });
  } catch (error) {
    console.error("Web Design Analyzer error:", error);
    sendResponse({
      ok: false,
      error: error.message || "No fue posible completar el analisis."
    });
  }

  return true;
});

function analyzePage() {
  const elements = Array.from(document.querySelectorAll("body *"));
  const colorMap = new Map();
  const fontMap = new Map();
  const buttons = [];
  const links = [];

  elements.forEach((element) => {
    const style = window.getComputedStyle(element);
    registerColor(colorMap, normalizeColor(style.color));
    registerColor(colorMap, normalizeColor(style.backgroundColor));
    registerFont(fontMap, normalizeFontFamily(style.fontFamily));

    if (isButton(element)) {
      buttons.push({
        text: cleanText(element.innerText || element.textContent || ""),
        selector: buildSelector(element)
      });
    }

    if (isLink(element)) {
      links.push({
        text: cleanText(element.innerText || element.textContent || ""),
        href: element.href || "",
        selector: buildSelector(element)
      });
    }
  });

  return {
    colors: sortCounts(colorMap, "value").slice(0, 12),
    fonts: sortCounts(fontMap, "family").slice(0, 12),
    buttons: buttons.slice(0, 20),
    links: links.slice(0, 20)
  };
}

function registerColor(map, color) {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
    return;
  }

  map.set(color, (map.get(color) || 0) + 1);
}

function registerFont(map, fontFamily) {
  if (!fontFamily) {
    return;
  }

  map.set(fontFamily, (map.get(fontFamily) || 0) + 1);
}

function sortCounts(map, keyName) {
  return Array.from(map.entries())
    .map(([value, count]) => ({ [keyName]: value, count }))
    .sort((a, b) => b.count - a.count);
}

function normalizeColor(color) {
  if (!color) {
    return "";
  }

  return color.replace(/\s+/g, " ").trim();
}

function normalizeFontFamily(fontFamily) {
  if (!fontFamily) {
    return "";
  }

  return fontFamily
    .split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean)[0] || "";
}

function isButton(element) {
  return (
    element.tagName === "BUTTON" ||
    (element.tagName === "INPUT" &&
      ["button", "submit", "reset"].includes((element.type || "").toLowerCase())) ||
    element.getAttribute("role") === "button"
  );
}

function isLink(element) {
  return element.tagName === "A" && !!element.href;
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

function buildSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }

  const className = (element.className || "")
    .toString()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(".");

  if (className) {
    return `${element.tagName.toLowerCase()}.${className}`;
  }

  return element.tagName.toLowerCase();
}

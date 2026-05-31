const analyzeButton = document.getElementById("analyzeButton");
const statusEl = document.getElementById("status");
const summaryEl = document.getElementById("summary");
const colorCountEl = document.getElementById("colorCount");
const fontCountEl = document.getElementById("fontCount");
const buttonCountEl = document.getElementById("buttonCount");
const linkCountEl = document.getElementById("linkCount");
const colorsListEl = document.getElementById("colorsList");
const fontsListEl = document.getElementById("fontsList");
const buttonsListEl = document.getElementById("buttonsList");
const linksListEl = document.getElementById("linksList");

analyzeButton.addEventListener("click", async () => {
  setLoadingState(true);
  setStatus("Analizando pagina...");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || typeof tab.id !== "number") {
      throw new Error("No se encontro una pestana activa.");
    }

    const response = await chrome.runtime.sendMessage({
      type: "ANALYZE_PAGE",
      tabId: tab.id
    });

    if (!response || !response.ok) {
      throw new Error(response?.error || "No fue posible analizar la pagina.");
    }

    renderResults(response.data);
    setStatus("Analisis completado.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Se produjo un error durante el analisis.");
  } finally {
    setLoadingState(false);
  }
});

function setLoadingState(isLoading) {
  analyzeButton.disabled = isLoading;
  analyzeButton.textContent = isLoading ? "Analizando..." : "Analizar";
}

function setStatus(message) {
  statusEl.textContent = message;
}

function renderResults(data) {
  const colors = data.colors || [];
  const fonts = data.fonts || [];
  const buttons = data.buttons || [];
  const links = data.links || [];

  colorCountEl.textContent = String(colors.length);
  fontCountEl.textContent = String(fonts.length);
  buttonCountEl.textContent = String(buttons.length);
  linkCountEl.textContent = String(links.length);
  summaryEl.hidden = false;

  renderColors(colors);
  renderFonts(fonts);
  renderButtons(buttons);
  renderLinks(links);
}

function renderColors(colors) {
  colorsListEl.innerHTML = "";
  colorsListEl.classList.toggle("empty", colors.length === 0);

  if (!colors.length) {
    colorsListEl.textContent = "Sin colores detectados";
    return;
  }

  colors.forEach((color) => {
    const item = document.createElement("article");
    item.className = "swatch";

    const sample = document.createElement("div");
    sample.className = "swatch__color";
    sample.style.backgroundColor = color.value;

    const meta = document.createElement("div");
    meta.className = "swatch__meta";

    const value = document.createElement("span");
    value.className = "swatch__value";
    value.textContent = color.value;

    const count = document.createElement("span");
    count.className = "swatch__count";
    count.textContent = `${color.count} usos`;

    meta.append(value, count);
    item.append(sample, meta);
    colorsListEl.appendChild(item);
  });
}

function renderFonts(fonts) {
  renderList(fontsListEl, fonts, (font) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="list__label">${escapeHtml(font.family)}</span>
      <span class="list__meta">${font.count} elementos</span>
    `;
    item.style.fontFamily = font.family;
    return item;
  }, "Sin fuentes detectadas");
}

function renderButtons(buttons) {
  renderList(buttonsListEl, buttons, (button) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="list__label">${escapeHtml(button.text || "(Sin texto)")}</span>
      <span class="list__meta">${escapeHtml(button.selector)}</span>
    `;
    return item;
  }, "Sin botones detectados");
}

function renderLinks(links) {
  renderList(linksListEl, links, (link) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="list__label">${escapeHtml(link.text || link.href || "(Sin texto)")}</span>
      <span class="list__meta">${escapeHtml(link.href || link.selector)}</span>
    `;
    return item;
  }, "Sin enlaces detectados");
}

function renderList(container, items, createItem, emptyText) {
  container.innerHTML = "";
  container.classList.toggle("empty", items.length === 0);

  if (!items.length) {
    const item = document.createElement("li");
    item.textContent = emptyText;
    container.appendChild(item);
    return;
  }

  items.forEach((entry) => {
    container.appendChild(createItem(entry));
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

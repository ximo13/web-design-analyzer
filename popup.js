const analyzeButton = document.getElementById("analyzeButton");
const generatePromptButton = document.getElementById("generatePromptButton");
const copyPromptButton = document.getElementById("copyPromptButton");
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
const promptOutputEl = document.getElementById("promptOutput");
const copyFeedbackEl = document.getElementById("copyFeedback");

let latestAnalysis = null;
let latestPageInsights = null;
let copyFeedbackTimer = null;

analyzeButton.addEventListener("click", async () => {
  setLoadingState(true, "analyze");
  setStatus("Analizando pagina...");

  try {
    const pageData = await runFullAnalysis();
    renderResults(pageData.analysis);
    setStatus("Analisis completado.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Se produjo un error durante el analisis.");
  } finally {
    setLoadingState(false, "analyze");
  }
});

generatePromptButton.addEventListener("click", async () => {
  setLoadingState(true, "prompt");
  setStatus("Generando prompt...");

  try {
    const pageData = latestAnalysis && latestPageInsights
      ? { analysis: latestAnalysis, insights: latestPageInsights }
      : await runFullAnalysis();

    const prompt = buildCodexPrompt(pageData.analysis, pageData.insights);
    promptOutputEl.value = prompt;
    setStatus("Prompt generado.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "No fue posible generar el prompt.");
  } finally {
    setLoadingState(false, "prompt");
  }
});

copyPromptButton.addEventListener("click", async () => {
  const prompt = promptOutputEl.value.trim();

  if (!prompt) {
    setStatus("Primero genera un prompt.");
    return;
  }

  try {
    await navigator.clipboard.writeText(prompt);
    showCopyFeedback();
    setStatus("Prompt copiado.");
  } catch (error) {
    console.error(error);
    setStatus("No se pudo copiar el prompt.");
  }
});

async function runFullAnalysis() {
  const tab = await getActiveTab();
  const analysis = await requestAnalysis(tab.id);
  const insights = await requestPageInsights(tab.id);
  latestAnalysis = analysis;
  latestPageInsights = insights;
  return { analysis, insights };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || typeof tab.id !== "number") {
    throw new Error("No se encontro una pestana activa.");
  }

  return tab;
}

async function requestAnalysis(tabId) {
  const response = await chrome.runtime.sendMessage({
    type: "ANALYZE_PAGE",
    tabId
  });

  if (!response || !response.ok) {
    throw new Error(response?.error || "No fue posible analizar la pagina.");
  }

  return response.data;
}

async function requestPageInsights(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const cleanText = (text) => (text || "").replace(/\s+/g, " ").trim();
      const take = (items, limit) => items.filter(Boolean).slice(0, limit);
      const unique = (items) => Array.from(new Set(items.filter(Boolean)));
      const has = (selector) => document.querySelector(selector) !== null;
      const h1 = take(Array.from(document.querySelectorAll("h1")).map((el) => cleanText(el.innerText)), 3);
      const h2 = take(Array.from(document.querySelectorAll("h2")).map((el) => cleanText(el.innerText)), 6);
      const bodyText = cleanText(document.body ? document.body.innerText : "").toLowerCase();
      const navLinks = document.querySelectorAll("nav a, header a").length;
      const productCards = document.querySelectorAll("[class*='product'], [data-product], article").length;
      const categoryBlocks = document.querySelectorAll("[class*='category'], [class*='collection'], [class*='shop']").length;
      const formControls = document.querySelectorAll("form input, form select, form textarea, form button").length;
      const mediaBlocks = document.querySelectorAll("img, picture, video").length;
      const components = unique([
        has("header") ? "Header" : "",
        navLinks >= 3 ? "Navegacion principal" : "",
        has("main") ? "Main content" : "",
        has("section") ? "Secciones modulares" : "",
        h1.length ? "Hero textual" : "",
        mediaBlocks >= 3 ? "Imagenes destacadas" : "",
        categoryBlocks >= 2 ? "Categorias destacadas" : "",
        productCards >= 4 ? "Grid de productos o tarjetas" : "",
        has("button, [role='button']") ? "Llamadas a la accion" : "",
        formControls >= 3 ? "Formulario o captura de leads" : "",
        has("footer") ? "Footer" : ""
      ]);

      return {
        url: location.href,
        title: document.title || "",
        h1,
        h2,
        components,
        signals: {
          bodyText,
          navLinks,
          productCards,
          categoryBlocks,
          formControls,
          mediaBlocks
        }
      };
    }
  });

  return results?.[0]?.result || {
    url: "",
    title: "",
    h1: [],
    h2: [],
    components: [],
    signals: {}
  };
}

function setLoadingState(isLoading, source) {
  if (source === "analyze") {
    analyzeButton.disabled = isLoading;
    analyzeButton.textContent = isLoading ? "Analizando..." : "Analizar";
    generatePromptButton.disabled = isLoading;
  }

  if (source === "prompt") {
    generatePromptButton.disabled = isLoading;
    generatePromptButton.textContent = isLoading ? "Generando..." : "Generar prompt para Codex";
    analyzeButton.disabled = isLoading;
  }

  copyPromptButton.disabled = isLoading;
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

function showCopyFeedback() {
  copyFeedbackEl.hidden = false;
  window.clearTimeout(copyFeedbackTimer);
  copyFeedbackTimer = window.setTimeout(() => {
    copyFeedbackEl.hidden = true;
  }, 2000);
}

function buildCodexPrompt(analysis, insights) {
  const colors = (analysis.colors || []).map((item) => item.value);
  const fonts = (analysis.fonts || []).map((item) => item.family);
  const buttonCount = (analysis.buttons || []).length;
  const linkCount = (analysis.links || []).length;
  const h1List = (insights.h1 || []).slice(0, 3);
  const h2List = (insights.h2 || []).slice(0, 6);
  const components = (insights.components || []).slice(0, 8);
  const probableType = inferWebsiteType(analysis, insights);
  const visualStyle = inferVisualStyle(analysis, insights, probableType);
  const palette = describePalette(colors);
  const structure = recommendStructure(probableType, insights);

  return [
    "Crea una landing inspirada en esta web.",
    "",
    `Tipo probable de web: ${probableType}.`,
    `Paleta detectada: ${palette}.`,
    `Fuentes detectadas: ${fonts.length ? fonts.join(", ") : "No claramente identificadas"}.`,
    `Numero de botones detectados: ${buttonCount}.`,
    `Numero de enlaces detectados: ${linkCount}.`,
    `H1 principales: ${h1List.length ? h1List.join(" | ") : "No detectados"}.`,
    `H2 principales: ${h2List.length ? h2List.join(" | ") : "No detectados"}.`,
    `Estilo visual estimado: ${visualStyle}.`,
    `Componentes detectados: ${components.length ? components.join(", ") : "No claramente detectados"}.`,
    `Recomendacion de estructura: ${structure}.`,
    "",
    "Instrucciones:",
    "- Disena una nueva web inspirada en la actual, sin copiar textos, composicion exacta, imagenes, marca ni jerarquia literal.",
    "- Conserva la logica comercial y el tono visual general, pero reinterpretalos con una ejecucion propia y mas actual.",
    "- Hazla mas moderna, rapida, responsive y con mejor conversion.",
    "- Prioriza claridad visual, buenas llamadas a la accion, secciones escaneables y rendimiento front-end.",
    "- Usa una hero grande y visual, bloques de categorias destacadas, seccion de servicios o productos, CTA de contacto y footer.",
    "- Si la web analizada sugiere ecommerce de mascotas, manten ese enfoque visual, comercial y orientado a producto como referencia, sin replicar el sitio original.",
    "- Propone una arquitectura limpia pensada para desktop y mobile.",
    "- Genera una interfaz lista para implementarse en HTML, CSS y JavaScript con criterio profesional."
  ].join("\n");
}

function inferWebsiteType(analysis, insights) {
  const bodyText = insights?.signals?.bodyText || "";
  const buttonCount = (analysis.buttons || []).length;
  const productSignals = insights?.signals?.productCards || 0;
  const categorySignals = insights?.signals?.categoryBlocks || 0;
  const hasPetTerms = /(mascota|perro|gato|pet|pienso|juguete|accesorio|veterin)/.test(bodyText);
  const hasShopTerms = /(comprar|tienda|shop|carrito|coleccion|producto|oferta)/.test(bodyText);

  if ((hasPetTerms && hasShopTerms) || (productSignals >= 4 && categorySignals >= 2)) {
    return "Ecommerce de mascotas";
  }

  if (hasShopTerms || productSignals >= 4 || buttonCount >= 6) {
    return "Ecommerce orientado a producto";
  }

  if ((insights?.signals?.formControls || 0) >= 4) {
    return "Web comercial de servicios";
  }

  return "Landing comercial visual";
}

function inferVisualStyle(analysis, insights, probableType) {
  const colors = (analysis.colors || []).map((item) => item.value.toLowerCase()).join(" ");
  const mediaBlocks = insights?.signals?.mediaBlocks || 0;
  const pinkTone = /(255,\s*192|255,\s*105|255,\s*182|pink|#f|#e9|#ff)/.test(colors);
  const base = probableType === "Ecommerce de mascotas"
    ? "Ecommerce de mascotas, visual, comercial y orientado a producto"
    : "Comercial, visual y orientado a conversion";

  if (pinkTone && mediaBlocks >= 3) {
    return `${base}, con una paleta clara apoyada por acentos rosados y una presencia fuerte de imagenes.`;
  }

  if (mediaBlocks >= 3) {
    return `${base}, con foco en imagenes grandes, bloques de producto y CTAs visibles.`;
  }

  return `${base}, limpio y funcional.`;
}

function describePalette(colors) {
  if (!colors.length) {
    return "No claramente detectada";
  }

  const names = colors.map(colorToName);
  const uniqueNames = Array.from(new Set(names));
  return uniqueNames.join(", ");
}

function colorToName(color) {
  const value = color.toLowerCase();

  if (value.includes("255, 255, 255") || value === "#fff" || value === "#ffffff") {
    return "blanco";
  }
  if (value.includes("0, 0, 0") || value === "#000" || value === "#000000") {
    return "negro";
  }
  if (/(128, 128, 128|117, 117, 117|160, 160, 160|169, 169, 169|204, 204, 204)/.test(value)) {
    return "gris";
  }
  if (/(255,\s*192,\s*203|255,\s*105,\s*180|255,\s*182,\s*193)/.test(value) || value.includes("pink")) {
    return "rosa";
  }
  if (/(0,\s*123,\s*255|37,\s*99,\s*235)/.test(value)) {
    return "azul";
  }

  return color;
}

function recommendStructure(probableType, insights) {
  const detected = insights?.components || [];
  const hasCategories = detected.includes("Categorias destacadas");
  const hasFooter = detected.includes("Footer");
  const parts = [
    "Header con navegacion",
    "Hero con imagen grande",
    hasCategories || probableType.includes("Ecommerce") ? "Categorias destacadas" : "Beneficios destacados",
    probableType.includes("Ecommerce") ? "Servicios o productos" : "Servicios principales",
    "CTA de contacto",
    hasFooter ? "Footer" : "Footer informativo"
  ];

  return parts.join(" | ");
}

const STORAGE_KEY = "jsonnet-review-content";
const THEME_KEY = "jsonnet-review-theme";
const FORMAT_KEY = "jsonnet-review-format";
const LAYOUT_MODE_KEY = "jsonnet-review-layout-mode";
const SPLIT_RATIO_KEY = "jsonnet-review-split-ratio";
const SPLIT_RATIO_MOBILE_KEY = "jsonnet-review-split-ratio-mobile";
const JSONNET_WASM_EXEC_URLS = ["https://jsonnet.org/js/wasm_exec.js", "./public/vendor/jsonnet/wasm_exec.js"];
const JSONNET_WASM_URLS = ["https://jsonnet.org/js/libjsonnet.wasm", "./public/vendor/jsonnet/libjsonnet.wasm"];
const JSONNET_RUNTIME_TIMEOUT_MS = 15000;

const SAMPLE = `local app = 'jsonnet-review';
local container(name, image, port) = {
  name: name,
  image: image,
  ports: [{ containerPort: port }],
};

{
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name: app,
    labels: { app: app },
  },
  spec: {
    replicas: 2,
    selector: { matchLabels: { app: app } },
    template: {
      metadata: { labels: { app: app } },
      spec: {
        containers: [
          container(app, 'nginx:1.27', 8080),
        ],
      },
    },
  },
}
`;

const editor = document.getElementById("editor");
const preview = document.querySelector("#preview code");
const layout = document.querySelector(".layout");
const splitterControls = document.getElementById("splitterControls");
const themeBtn = document.getElementById("themeBtn");
const sampleBtn = document.getElementById("sampleBtn");
const copyInputBtn = document.getElementById("copyInputBtn");
const copyOutputBtn = document.getElementById("copyOutputBtn");
const clearBtn = document.getElementById("clearBtn");
const formatSelect = document.getElementById("formatSelect");
const statusBadge = document.getElementById("statusBadge");
const previewTitle = document.getElementById("previewTitle");
const inputMeta = document.getElementById("inputMeta");

let jsonnetRuntimePromise = null;
let latestOutput = "";
let renderSequence = 0;
let codeEditor = null;
let suppressEditorChange = false;

function applyLayoutMode(mode) {
  const nextMode = ["editor", "split", "preview"].includes(mode) ? mode : "split";
  document.documentElement.setAttribute("data-layout-mode", nextMode);
  layout.setAttribute("data-layout-mode", nextMode);
  requestAnimationFrame(() => codeEditor?.refresh());
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 960px)").matches;
}

function applySplitRatio(ratio, isMobile) {
  const nextRatio = clamp(ratio, 0.18, 0.82);
  layout.style.setProperty(isMobile ? "--split-ratio-mobile" : "--split-ratio", `${nextRatio * 100}%`);
  return nextRatio;
}

applyLayoutMode(localStorage.getItem(LAYOUT_MODE_KEY) || "split");
applySplitRatio(Number(localStorage.getItem(SPLIT_RATIO_KEY)) || 0.5, false);
applySplitRatio(Number(localStorage.getItem(SPLIT_RATIO_MOBILE_KEY)) || 0.5, true);

const modeCycle = ["editor", "preview", "split"];
let dragState = null;
let ignoreClickAfterDrag = false;

splitterControls.addEventListener("pointerdown", (event) => {
  const mobile = isMobileViewport();
  const size = mobile ? layout.clientHeight : layout.clientWidth;
  if (!size) return;

  const ratio = Number(
    getComputedStyle(layout).getPropertyValue(mobile ? "--split-ratio-mobile" : "--split-ratio").replace("%", "")
  );

  dragState = {
    mobile,
    startPos: mobile ? event.clientY : event.clientX,
    startRatio: Number.isFinite(ratio) ? ratio / 100 : 0.5,
    moved: false,
  };

  splitterControls.setPointerCapture(event.pointerId);
});

splitterControls.addEventListener("pointermove", (event) => {
  if (!dragState) return;

  const size = dragState.mobile ? layout.clientHeight : layout.clientWidth;
  if (!size) return;

  const currentPos = dragState.mobile ? event.clientY : event.clientX;
  const deltaPx = currentPos - dragState.startPos;
  const deltaRatio = deltaPx / size;

  if (Math.abs(deltaPx) > 4 && !dragState.moved) {
    dragState.moved = true;
  }

  if (dragState.moved && layout.getAttribute("data-layout-mode") !== "split") {
    localStorage.setItem(LAYOUT_MODE_KEY, "split");
    applyLayoutMode("split");
  }

  const nextRatio = applySplitRatio(dragState.startRatio + deltaRatio, dragState.mobile);
  localStorage.setItem(dragState.mobile ? SPLIT_RATIO_MOBILE_KEY : SPLIT_RATIO_KEY, String(nextRatio));
});

function stopDrag(pointerId) {
  if (!dragState) return;
  ignoreClickAfterDrag = dragState.moved;
  dragState = null;
  requestAnimationFrame(() => codeEditor?.refresh());
  if (pointerId !== undefined) {
    splitterControls.releasePointerCapture(pointerId);
  }
}

splitterControls.addEventListener("pointerup", (event) => stopDrag(event.pointerId));
splitterControls.addEventListener("pointercancel", () => stopDrag());
splitterControls.addEventListener("click", () => {
  if (ignoreClickAfterDrag) {
    ignoreClickAfterDrag = false;
    return;
  }

  const current = layout.getAttribute("data-layout-mode") || "split";
  const nextMode = modeCycle[(modeCycle.indexOf(current) + 1) % modeCycle.length];
  localStorage.setItem(LAYOUT_MODE_KEY, nextMode);
  applyLayoutMode(nextMode);
});

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  themeBtn.textContent = theme === "dark" ? "白天模式" : "夜间模式";
}

applyTheme(localStorage.getItem(THEME_KEY) || "light");

themeBtn.addEventListener("click", () => {
  const nextTheme = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, nextTheme);
  applyTheme(nextTheme);
});

function setStatus(text, isError = false, type = getStatusType(text, isError)) {
  statusBadge.textContent = text;
  statusBadge.title = getStatusDescription(text, isError);
  statusBadge.classList.remove("is-error", "is-loading", "is-success", "is-warning");
  if (type) {
    statusBadge.classList.add(type);
  }
}

function getStatusType(text, isError) {
  if (isError) return "is-error";
  if (text === "加载中" || text === "加载 WASM" || text === "渲染中") return "is-loading";
  if (text === "完整加载" || text === "go-jsonnet WASM") return "is-success";
  if (text === "有限预览" || text === "受限预览") return "is-warning";
  return "";
}

function getStatusDescription(text, isError) {
  if (isError) {
    return "Jsonnet 运行失败，请检查语法、网络连接或 WASM 运行时加载状态。";
  }

  const descriptions = {
    初始化: "页面正在初始化 Jsonnet 预览环境。",
    加载中: "正在加载 go-jsonnet WebAssembly 运行时；第三方资源不可用时会尝试本地资源。",
    "加载 WASM": "正在加载 go-jsonnet WebAssembly 运行时；第三方资源不可用时会尝试本地资源。",
    渲染中: "正在执行当前 Jsonnet 内容并生成预览结果。",
    完整加载: "当前使用官方 go-jsonnet WebAssembly 运行时，支持单文件 Jsonnet 主体语法。",
    "go-jsonnet WASM": "当前使用官方 go-jsonnet WebAssembly 运行时，支持单文件 Jsonnet 主体语法。",
    有限预览: "当前没有完整 Jsonnet 运行时，仅能进行有限语法预览。",
    受限预览: "当前没有完整 Jsonnet 运行时，仅能进行有限语法预览。",
    空内容: "编辑区为空，暂无可预览内容。",
  };

  return descriptions[text] || "当前 Jsonnet 预览状态。";
}

async function loadJsonnetRuntime() {
  if (!jsonnetRuntimePromise) {
    jsonnetRuntimePromise = bootJsonnetWasm();
  }

  return jsonnetRuntimePromise;
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
}

function loadScript(src, timeoutMs = JSONNET_RUNTIME_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error(`Script load timeout: ${src}`));
    }, timeoutMs);

    script.src = src;
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`Script load failed: ${src}`));
    };
    document.body.appendChild(script);
  });
}

async function loadFirstAvailableScript(urls) {
  let lastError = null;
  for (const url of urls) {
    try {
      await loadScript(url);
      return url;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No script URL configured.");
}

function ensureWasmStreamingFallback() {
  if (!WebAssembly.instantiateStreaming) {
    WebAssembly.instantiateStreaming = async (responsePromise, importObject) => {
      const response = await responsePromise;
      const source = await response.arrayBuffer();
      return WebAssembly.instantiate(source, importObject);
    };
  }
}

async function waitForJsonnetApi() {
  const startedAt = Date.now();
  while (typeof window.jsonnet_evaluate_snippet !== "function") {
    if (Date.now() - startedAt > JSONNET_RUNTIME_TIMEOUT_MS) {
      throw new Error("Jsonnet WASM API was not initialized.");
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function bootJsonnetWasm() {
  ensureWasmStreamingFallback();
  await loadFirstAvailableScript(JSONNET_WASM_EXEC_URLS);

  if (typeof window.Go !== "function") {
    throw new Error("Go WASM bootstrap script did not expose Go().");
  }

  const go = new window.Go();
  const result = await instantiateFirstAvailableWasm(go.importObject);
  go.run(result.instance).catch((error) => {
    console.error("Jsonnet WASM stopped:", error);
  });
  await waitForJsonnetApi();

  return {
    name: "go-jsonnet WASM",
    async evaluate(source) {
      return window.jsonnet_evaluate_snippet(
        "main.jsonnet",
        source,
        { "main.jsonnet": source },
        {},
        {},
        {},
        {}
      );
    },
  };
}

async function instantiateFirstAvailableWasm(importObject) {
  let lastError = null;

  for (const url of JSONNET_WASM_URLS) {
    try {
      return await withTimeout(
        WebAssembly.instantiateStreaming(fetch(url, { mode: "cors" }), importObject),
        JSONNET_RUNTIME_TIMEOUT_MS,
        `Jsonnet WASM load timeout: ${url}`
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No WASM URL configured.");
}

function toYaml(value, indent = 0) {
  const pad = " ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          return `${pad}- ${toYaml(item, indent + 2).trimStart()}`;
        }
        return `${pad}- ${formatYamlScalar(item)}`;
      })
      .join("\n");
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return entries
      .map(([key, item]) => {
        if (item && typeof item === "object") {
          return `${pad}${key}:\n${toYaml(item, indent + 2)}`;
        }
        return `${pad}${key}: ${formatYamlScalar(item)}`;
      })
      .join("\n");
  }

  return `${pad}${formatYamlScalar(value)}`;
}

function formatYamlScalar(value) {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === "") return '""';
  if (/^[A-Za-z0-9_.:/@-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function formatOutput(jsonText, format) {
  const value = JSON.parse(jsonText);
  if (format === "yaml") return toYaml(value);
  return JSON.stringify(value, null, 2);
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function highlight(text, format) {
  if (format === "yaml") {
    return escapeHtml(text).replace(/^(\s*[\w.-]+:)/gm, '<span class="token-key">$1</span>');
  }

  if (format === "json") {
    return highlightJson(text);
  }

  return escapeHtml(text);
}

function highlightJson(text) {
  let html = "";
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (char === '"') {
      const end = readJsonStringEnd(text, index);
      const token = text.slice(index, end);
      const nextNonWhitespace = readNextNonWhitespace(text, end);
      const tokenClass = nextNonWhitespace === ":" ? "token-key" : "token-string";
      html += `<span class="${tokenClass}">${escapeHtml(token)}</span>`;
      index = end;
      continue;
    }

    const literalMatch = text.slice(index).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|^(?:true|false)|^null/);
    if (literalMatch) {
      const token = literalMatch[0];
      const tokenClass = token === "true" || token === "false" ? "token-boolean" : token === "null" ? "token-null" : "token-number";
      html += `<span class="${tokenClass}">${token}</span>`;
      index += token.length;
      continue;
    }

    html += escapeHtml(char);
    index += 1;
  }

  return html;
}

function readJsonStringEnd(text, start) {
  let escaped = false;
  for (let index = start + 1; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === '"') {
      return index + 1;
    }
  }
  return text.length;
}

function readNextNonWhitespace(text, start) {
  for (let index = start; index < text.length; index += 1) {
    if (!/\s/.test(text[index])) {
      return text[index];
    }
  }
  return "";
}

async function render(source) {
  const sequence = ++renderSequence;
  const format = formatSelect.value;
  previewTitle.textContent = `结果区（${format.toUpperCase()}）`;
  inputMeta.textContent = `${source.length} chars`;

  if (!source.trim()) {
    latestOutput = "";
    preview.textContent = "";
    setStatus("空内容");
    return;
  }

  try {
    setStatus("加载 WASM");
    const runtime = await loadJsonnetRuntime();
    if (sequence !== renderSequence) return;

    setStatus("渲染中");
    const evaluated = await runtime.evaluate(source);
    if (sequence !== renderSequence) return;

    const jsonText = typeof evaluated === "string" ? evaluated : JSON.stringify(evaluated, null, 2);
    latestOutput = formatOutput(jsonText, format);
    preview.innerHTML = highlight(latestOutput, format);
    setStatus(runtime.name);
  } catch (error) {
    if (sequence !== renderSequence) return;
    latestOutput = "";
    preview.textContent = error?.message || String(error);
    setStatus("运行失败", true);
  }
}

function debounce(fn, delay) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const saveAndRender = debounce((value) => {
  localStorage.setItem(STORAGE_KEY, value);
  render(value);
}, 120);

function initializeEditor(initialValue) {
  editor.value = initialValue;

  if (window.CodeMirror) {
    codeEditor = window.CodeMirror.fromTextArea(editor, {
      mode: "jsonnet",
      indentUnit: 2,
      tabSize: 2,
      matchBrackets: true,
      lineWrapping: false,
      extraKeys: {
        Tab(cm) {
          if (cm.somethingSelected()) {
            cm.indentSelection("add");
          } else {
            cm.execCommand("insertSoftTab");
          }
        },
        "Shift-Tab"(cm) {
          cm.indentSelection("subtract");
        },
      },
    });

    codeEditor.setSize("100%", "100%");
    codeEditor.on("change", (instance) => {
      if (!suppressEditorChange) {
        saveAndRender(instance.getValue());
      }
    });
    return;
  }

  editor.addEventListener("input", (event) => saveAndRender(event.target.value));
}

function getEditorValue() {
  return codeEditor ? codeEditor.getValue() : editor.value;
}

function setEditorValue(value) {
  if (codeEditor) {
    suppressEditorChange = true;
    codeEditor.setValue(value);
    suppressEditorChange = false;
    codeEditor.refresh();
    return;
  }

  editor.value = value;
}

function focusEditor() {
  if (codeEditor) {
    codeEditor.focus();
  } else {
    editor.focus();
  }
}

formatSelect.value = localStorage.getItem(FORMAT_KEY) || "json";
formatSelect.addEventListener("change", () => {
  localStorage.setItem(FORMAT_KEY, formatSelect.value);
  render(getEditorValue());
});

sampleBtn.addEventListener("click", () => {
  setEditorValue(SAMPLE);
  localStorage.setItem(STORAGE_KEY, SAMPLE);
  render(SAMPLE);
});

async function copyText(button, text, label) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "已复制";
  } catch {
    button.textContent = "复制失败";
  }

  setTimeout(() => {
    button.textContent = label;
  }, 1200);
}

copyInputBtn.addEventListener("click", () => copyText(copyInputBtn, getEditorValue(), "复制 Jsonnet"));
copyOutputBtn.addEventListener("click", () => copyText(copyOutputBtn, latestOutput, "复制结果"));

clearBtn.addEventListener("click", () => {
  setEditorValue("");
  localStorage.setItem(STORAGE_KEY, "");
  render("");
  focusEditor();
});

const initial = localStorage.getItem(STORAGE_KEY) || SAMPLE;
initializeEditor(initial);
render(initial);

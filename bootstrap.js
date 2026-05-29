const ASSET_TIMEOUT_MS = 2500;

const ASSETS = {
  css: [
    {
      name: "codemirror-style",
      cdn: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.20/codemirror.min.css",
      local: "./public/vendor/codemirror/codemirror.min.css",
    },
  ],
  js: [
    {
      name: "codemirror",
      cdn: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.20/codemirror.min.js",
      local: "./public/vendor/codemirror/codemirror.min.js",
    },
    {
      name: "codemirror-matchbrackets",
      cdn: "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.20/addon/edit/matchbrackets.min.js",
      local: "./public/vendor/codemirror/addon/edit/matchbrackets.min.js",
    },
    {
      name: "codemirror-jsonnet-mode",
      cdn: "https://jsonnet.org/js/codemirror-mode-jsonnet.js",
      local: "./public/vendor/codemirror/mode/jsonnet/codemirror-mode-jsonnet.js",
    },
  ],
};

function loadStyle(href, timeoutMs) {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    const timer = setTimeout(() => {
      link.remove();
      reject(new Error(`Style load timeout: ${href}`));
    }, timeoutMs);

    link.rel = "stylesheet";
    link.href = href;
    link.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    link.onerror = () => {
      clearTimeout(timer);
      link.remove();
      reject(new Error(`Style load failed: ${href}`));
    };

    document.head.appendChild(link);
  });
}

function loadScript(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      script.remove();
      reject(new Error(`Script load timeout: ${src}`));
    }, timeoutMs);

    script.src = src;
    script.async = false;
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timer);
      script.remove();
      reject(new Error(`Script load failed: ${src}`));
    };

    document.body.appendChild(script);
  });
}

async function loadWithFallback(asset, loader) {
  try {
    await loader(asset.cdn, ASSET_TIMEOUT_MS);
    return "cdn";
  } catch {
    await loader(asset.local, ASSET_TIMEOUT_MS);
    console.warn(`[fallback] ${asset.name} loaded from local`);
    return "local";
  }
}

async function bootstrap() {
  for (const cssAsset of ASSETS.css) {
    await loadWithFallback(cssAsset, loadStyle);
  }

  for (const jsAsset of ASSETS.js) {
    await loadWithFallback(jsAsset, loadScript);
  }

  await loadScript("./app.js", ASSET_TIMEOUT_MS);
}

bootstrap().catch((error) => {
  console.error("Asset bootstrap failed:", error);
});

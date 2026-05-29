# jsonnet-review

I created this minimal Jsonnet online preview project with a split editor / preview layout.

## Environment Info

- Authoring agent: Codex
- Model used: GPT-5 (Codex coding agent runtime)
- App runtime: Codex CLI

## Online

- Live URL: [https://jsonnet.acexy.cn](https://jsonnet.acexy.cn)

## Features

- I implemented real-time preview while typing
- I integrated the official go-jsonnet WebAssembly runtime
- I designed CDN-first loading with automatic local fallback
- I added local vendor assets for Jsonnet WASM execution
- I integrated CodeMirror 5 for Jsonnet syntax highlighting
- I enabled line numbers, bracket matching, and soft-tab indentation
- I added JSON and YAML output modes
- I added syntax highlighting for JSON and YAML preview output
- I added local storage persistence
- I provided sample / clear / copy Jsonnet / copy result actions
- I added live character count in the editor title
- I added a status badge with hover descriptions
- I added a light/dark theme toggle (default light)
- I made the layout responsive for desktop and mobile

## Quick Start

1. Serve this repository with a static HTTP server.
2. Open `index.html` through the HTTP URL.
3. Type Jsonnet in the left editor panel.
4. View JSON or YAML output in the right preview panel.

## Project Structure

- `index.html`: page skeleton and UI structure
- `bootstrap.js`: CDN-first loader with local fallback
- `style.css`: layout and visual styles
- `app.js`: Jsonnet rendering and interactions
- `public/assets`: local page assets
- `public/vendor/codemirror`: local CodeMirror 5 editor assets
- `public/vendor/jsonnet`: local go-jsonnet WebAssembly runtime assets

## Notes

- I built this as a static frontend implementation.
- No build tool or install step is required to run it.
- A static HTTP server is recommended because browsers usually block `fetch()` for local `.wasm` files opened through `file://`.
- The current editor is single-file. Jsonnet language features are handled by go-jsonnet, but external `import` files are not managed by the UI yet.

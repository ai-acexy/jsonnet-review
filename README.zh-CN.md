# jsonnet-review

我创建了这个简洁的 Jsonnet 在线预览项目，采用左右分栏的编辑与预览布局。

## 环境信息

- 创作代理：Codex
- 使用模型：GPT-5（Codex coding agent runtime）
- 运行环境：Codex CLI

## 在线地址

- 使用地址：尚未发布

## 功能

- 我实现了输入时实时预览
- 我集成了官方 go-jsonnet WebAssembly 运行时
- 我增加了 Jsonnet WASM 执行所需的本地依赖资源
- 我集成了 CodeMirror 5 用于 Jsonnet 语法高亮
- 我启用了行号、括号匹配与软 Tab 缩进
- 我增加了 JSON 与 YAML 输出模式
- 我增加了 JSON 与 YAML 预览结果语法高亮
- 我增加了本地存储持久化
- 我提供了示例内容 / 清空 / 复制 Jsonnet / 复制结果操作
- 我在编辑区标题增加了实时字符统计
- 我增加了带悬停说明的状态提示
- 我增加了白天/黑夜主题切换（默认白天）
- 我让页面在桌面端与移动端都能自适应

## 快速开始

1. 使用静态 HTTP 服务托管本仓库。
2. 通过 HTTP 地址打开 `index.html`。
3. 在左侧编辑区输入 Jsonnet。
4. 在右侧预览区查看 JSON 或 YAML 输出。

## 项目结构

- `index.html`：页面骨架与 UI 结构
- `style.css`：布局与视觉样式
- `app.js`：Jsonnet 渲染与交互逻辑
- `public/assets`：页面本地资源
- `public/vendor/codemirror`：本地 CodeMirror 5 编辑器资源
- `public/vendor/jsonnet`：本地 go-jsonnet WebAssembly 运行时资源

## 说明

- 我将本项目实现为纯静态前端方案。
- 无需构建工具，也无需安装依赖即可运行。
- 建议使用静态 HTTP 服务访问，因为浏览器直接通过 `file://` 打开时，通常会限制 `fetch()` 本地 `.wasm` 文件。
- 当前编辑器是单文件模式。Jsonnet 语言能力由 go-jsonnet 提供，但 UI 暂未管理外部 `import` 文件。

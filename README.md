# SalesLink / 销数通Agent-自测版

SalesLink 是一个面向销售场景的数据分析 Agent 应用。当前版本重点搭建本地可运行的会话体验：用户在会话页输入问题，系统通过本地 Express 代理调用 OpenAI-compatible 大模型接口，并以流式方式展示 Agent 的思考过程和最终回答。

当前 UI 标题为 **销数通Agent-自测版**。

## 主要能力

- 三栏式会话界面
  - 左侧：应用标题、新会话入口、历史会话列表、会话删除。
  - 中间：会话标题、消息流、Agent 思考过程、Markdown 回答、底部输入框。
  - 右侧：大模型配置面板，支持 `API_KEY`、`BaseURL`、`Model`。
- 本地会话管理
  - 新建会话。
  - 切换历史会话。
  - 删除会话；删除最后一个会话时会自动创建新会话。
  - 会话、当前激活会话和模型配置保存在浏览器 `localStorage`。
- OpenAI-compatible 模型调用
  - ���览器只请求本地 `/api/chat`。
  - 后端代理负责转发到 `${BaseURL}/chat/completions`。
  - 避免浏览器直接跨域请求模型接口导致 CORS 问题。
- SSE 流式响应
  - 后端通过 Server-Sent Events 返回执行过程和回答增量。
  - 前端通过 `fetch + ReadableStream` 解析流式事件。
  - 最终回答不会一次性出现，而是逐步打印。
- 动态 ReAct Agent 编排
  - 服务端使用大模型生成结构化 ReAct step。
  - 展示“正在思考 / 已完成思考”过程。
  - 支持步骤：分析、行动、观察、目标校验。
  - 思考阶段完成后自动收起过程面板，再开始流式输出正式回答。
- Markdown 渲染
  - Assistant 回答使用 `react-markdown` 和 `remark-gfm` 渲染。
  - 支持标题、列表、表格、引用、行内代码和代码块。

## 技术栈

- 前端：Vite + React
- 样式：CSS，GitHub 风格三栏布局
- 后端：Express
- 模型协议：OpenAI-compatible `/chat/completions`
- 流式协议：Server-Sent Events，前端使用 `ReadableStream` 消费
- Markdown：`react-markdown` + `remark-gfm`
- 浏览器验证：项目配置了 Chrome DevTools MCP（见 `.mcp.json`）

## 环境要求

- Node.js：建议使用当前本机 Node 版本或较新的 LTS 版本。
- npm
- 可访问 OpenAI-compatible 模型服务，例如火山 Ark/OpenAI-compatible endpoint。

## 安装依赖

在项目根目录执行：

```bash
npm install
```

如果遇到权限错误，例如 `EACCES: permission denied`，通常是本地 `node_modules` 或 npm cache 中存在非当前用户拥有的文件。可先修复权限：

```bash
sudo chown -R bytedance:staff /Users/bytedance/sales_link
sudo chown -R bytedance:staff /Users/bytedance/.npm
```

然后重新安装：

```bash
npm install
```

## 启动方式

### 本地开发启动

```bash
npm run dev
```

启动后终端会输出类似：

```text
SalesLink running at http://localhost:5173
```

打开浏览器访问：

```text
http://localhost:5173
```

### 生产构建

```bash
npm run build
```

构建产物会输出到 `dist/`。

### 构建后启动生产服务

```bash
npm run start
```

`npm run start` 会以 `NODE_ENV=production` 启动 `server.js`，并服务 `dist/` 静态资源。

### 预览生产服务

```bash
npm run preview
```

当前 `preview` 等价于：

```bash
npm run start
```

## npm scripts

`package.json` 中定义了以下脚本：

```json
{
  "dev": "node server.js",
  "build": "vite build",
  "start": "NODE_ENV=production node server.js",
  "preview": "npm run start"
}
```

目前没有配置：

- lint
- test
- type-check
- single-test

## 大模型配置

页面右侧配置面板包含三个字段：

- `API_KEY`
- `BaseURL`
- `Model`

默认 BaseURL：

```text
https://ark.cn-beijing.volces.com/api/v3
```

请求会由浏览器发到本地：

```text
POST /api/chat
```

后端再转发到：

```text
${BaseURL}/chat/completions
```

注意：右侧配置会保存在当前浏览器的 `localStorage` 中。当前版本为了自测便利，API Key 从前端输入并存储在浏览器本地；生产环境不建议这样处理，应改为服务端安全配置或用户凭证体系。

## 前端界面说明

### 左侧栏

左侧栏包含：

- 应用标题：`销数通Agent-自测版`
- 标题左侧机器人图标
- `新会话` 按钮
- 历史会话列表
- 会话删除按钮

会话标题会使用用户第一条消息的前 18 个字符作为默认标题。

### 中间会话区

中间区域包含：

- 顶部会话标题
- 消息列表
- Assistant 的 Agent 思考过程
- Assistant 的 Markdown 回答
- 错误提示
- 底部输入框和发送按钮

输入框行为：

- 默认一行高度。
- 输入内容增多时自动向上扩展。
- 最多四行高度。
- 超过四行后输入框内部滚动。
- 发送按钮保持固定单行高度。
- `Enter` 发送，`Shift + Enter` 换行。

### 右侧配置区

右侧配置区用于填写模型参数：

- `API_KEY`
- `BaseURL`
- `Model`

## Agent 思考过程设计

当前版本实现了轻量动态 ReAct Orchestrator。

用户发送消息后，前端会立即插入一条 streaming assistant 消息，并显示：

```text
正在思考
```

后端随后通过 SSE 推送结构化步骤：

1. `status`
   - 通知前端进入思考阶段。
2. `step_start`
   - 开始一个 Agent 步骤。
3. `step_delta`
   - 流式追加步骤文本。
4. `step_end`
   - 当前步骤完成。
5. `answer_start`
   - 思考过程结束，前端自动收起思考模块。
6. `answer`
   - 流式输出最终回答。
7. `done`
   - 本轮完成。
8. `error`
   - 出错。

步骤类型：

- `thought`：分析用户问题。
- `action`：说明将采取的动作或工具。
- `observation`：工具执行或上下文分析结果。
- `reflection`：目标校验，判断是否偏离用户问题。

当前思考过程 UI：

- 思考中标题显示为 `正在思考`。
- 完成后标题显示为 `已完成思考`。
- 思考阶段默认展开。
- 收到 `answer_start` 或 `done` 后自动收起。
- 展开后以时间线形式展示步骤内容。
- 每个步骤左侧有小圆点，步骤之间用竖线连接。
- 不显示“分析 / 行动 / 观察 / 目标校验”等步骤标题，只显示步骤内容。

## ReAct 编排流程

第一版采用“一轮动态 ReAct + 最终回答”的方式，避免无限循环。

流程在 `server/reactAgent.js` 中：

1. 获取最新用户问题。
2. 发送 `status: thinking`。
3. 调用模型生成结构化 ReAct step。
4. 流式播放 Thought。
5. 流式播放 Action。
6. 调用工具得到 Observation。
7. 流式播放 Observation。
8. 调用模型生成 Reflection。
9. 流式播放 Reflection。
10. 发送 `answer_start`。
11. 调用模型流式生成最终 Answer。
12. 发送 `done`。

### 结构化 ReAct step

模型被要求输出 JSON，例如：

```json
{
  "thought": "用户要求做一份竞品分析报告，目标竞品是瓜子二手车。这个任务需要先收集公开信息，再整理报告结构。",
  "action": {
    "tool": "web_search",
    "input": {
      "query": "瓜子二手车 竞品分析 商业模式 用户评价"
    },
    "reason": "竞品分析需要参考公开信息。"
  }
}
```

如果模型返回的 JSON 不合法，后端会尝试进行一次 JSON 修复。

### Reflection

Reflection 也由模型生成 JSON，例如：

```json
{
  "reflection": "当前观察结果仍服务于竞品分析报告目标，但实时搜索不可用，因此最终回答需要标注实时性限制。",
  "offTrack": false
}
```

## 工具系统

工具注册在：

```text
server/tools.js
```

当前支持：

### `none`

表示无需调用外部工具。

返回示例：

```json
{
  "ok": true,
  "tool": "none",
  "summary": "当前问题可以基于已有上下文继续处理，无需调用外部工具。"
}
```

### `web_search`

用于公开网页搜索场景，例如竞品、市场、公司动态、公开资料检索。

当前版本没有接入真实 Web Search API，因此该工具会透明返回不可用，不会伪造搜索结果。

返回示例：

```json
{
  "ok": false,
  "unavailable": true,
  "tool": "web_search",
  "query": "瓜子二手车 竞品分析 商业模式 用户评价",
  "summary": "当前未配置真实 Web Search API，无法获取实时公开网页结果。后续回答将基于模型已有知识和用户提供的信息，并明确标注实时性限制。"
}
```

后续如需接入真实搜索，可在 `server/tools.js` 中扩展，并通过服务端环境变量配置搜索服务，不建议由前端直接调用搜索 API。

## 目录结构

```text
sales_link/
├── AGENTS.md
├── README.md
├── index.html
├── package.json
├── package-lock.json
├── server.js
├── vite.config.js
├── .mcp.json
├── src/
│   ├── main.jsx
│   └── styles.css
├── server/
│   ├── modelClient.js
│   ├── prompts.js
│   ├── reactAgent.js
│   ├── sse.js
│   └── tools.js
├── sales_link_ck.xlsx
├── sales_link_ck.csv
├── sales_link_ck_order.xlsx
├── sales_link_ck_order.csv
├── sales_link_ck_fund.xlsx
├── sales_link_ck_fund.csv
├── sales_link_ck_charge_order.xlsx
├── sales_link_ck_charge_order.csv
├── sales_link_ck_project.xlsx
├── sales_link_ck_project.csv
├── sales_link_ck_o5a.xlsx
└── sales_link_ck_o5a.csv
```

说明：部分 `sales_link_ck*` 数据文件当前可能是本地未提交文件，使用前请以当前工作区和 Git 状态为准。

## 关键文件说明

### `server.js`

Express 应用入口。

职责：

- 创建 Express app。
- 注册 `/api/chat`。
- 校验模型配置和消息。
- 准备 SSE 响应。
- 调用 `runReactAgent`。
- 开发环境挂载 Vite middleware。
- 生产环境服务 `dist/`。

### `server/sse.js`

SSE 工具函数。

职责：

- 设置 SSE 响应头。
- 输出标准 SSE event。
- 输出 error event。
- 将步骤文本切成小段，通过 `step_delta` 流式播放。

### `server/modelClient.js`

OpenAI-compatible 模型客户端。

职责：

- 非流式收集模型文本。
- 流式读取模型 answer。
- 解析 OpenAI-compatible SSE。
- 提取 `delta.content`、`reasoning_content`、`thinking` 等字段。
- ��析模型返回的 JSON。

### `server/prompts.js`

Prompt 构造模块。

职责：

- 构造 ReAct step prompt。
- 构造 Reflection prompt。
- 构造最终回答 prompt。
- 构造 JSON 修复 prompt。

### `server/tools.js`

工具注册与执行。

职责：

- 暴露可用工具列表。
- 执行工具。
- 当前支持 `none` 和透明不可用的 `web_search`。

### `server/reactAgent.js`

轻量 ReAct Orchestrator。

职责：

- 组织 Thought / Action / Observation / Reflection / Answer 流程。
- 调用模型生成结构化步骤。
- 调用工具生成观察结果。
- 调用模型生成目标校验。
- 触发最终回答流式输出。

### `src/main.jsx`

React 应用主入口。

职责：

- 管理会话状态。
- 管理模型配置。
- 发送消息。
- 消费 SSE 流。
- 更新 Agent steps、answer content 和消息状态。
- 渲染三栏 UI。
- 使用 `react-markdown` 渲染 Assistant Markdown 内容。

### `src/styles.css`

全局样式。

职责：

- GitHub 风格三栏布局。
- 左侧会话列表样式。
- 中间会话页布局。
- Agent 思考过程时间线样式。
- Markdown 内容样式。
- 底部输入框自适应样式。
- 右侧模型配置面板样式。

## localStorage

状态保存在：

```text
saleslink-state-v1
```

保存内容：

- `conversations`
- `activeId`
- `config`

为了避免流式输出时频繁写入，当前前端对 localStorage 写入做了 500ms debounce。

如果需要清空本地会话，可在浏览器控制台执行：

```js
localStorage.removeItem('saleslink-state-v1')
```

然后刷新页面。

## SSE 协议

当前本地 `/api/chat` 会返回 `text/event-stream`。

事件示例：

```text
event: status
data: {"phase":"thinking","text":"开始思考"}

event: step_start
data: {"id":"thought-1","type":"thought","title":"分析"}

event: step_delta
data: {"id":"thought-1","text":"用户要求做一份竞品分析报告..."}

event: step_end
data: {"id":"thought-1","status":"done"}

event: answer_start
data: {}

event: answer
data: {"text":"# 竞品分析报告"}

event: done
data: {"finishReason":"stop"}
```

错误事件：

```text
event: error
data: {"error":"模型调用失败"}
```

## 数据文件

项目包含销售链路相关数据字典/数据资产文件。

当前已知主文件：

```text
sales_link_ck.xlsx
```

根据此前检查，它包含销售链路维度和指标字段，例如：

- `attribution_date`
- `advertiser_id`
- `advertiser_name`
- `customer_id`

当前工作区还存在拆分数据文件：

```text
sales_link_ck.csv
sales_link_ck_order.xlsx
sales_link_ck_order.csv
sales_link_ck_fund.xlsx
sales_link_ck_fund.csv
sales_link_ck_charge_order.xlsx
sales_link_ck_charge_order.csv
sales_link_ck_project.xlsx
sales_link_ck_project.csv
sales_link_ck_o5a.xlsx
sales_link_ck_o5a.csv
```

分析 `.xlsx` 文件时应使用 `openpyxl` 等表格工具，不要用普通文本读取。

示例：

```bash
python3 - <<'PY'
from pathlib import Path
import openpyxl

path = Path('sales_link_ck.xlsx')
wb = openpyxl.load_workbook(path, read_only=True, data_only=False)
print(wb.sheetnames)
for ws in wb.worksheets:
    print(ws.title, ws.max_row, ws.max_column)
    for row in ws.iter_rows(min_row=1, max_row=5, values_only=True):
        print(row)
PY
```

## Chrome DevTools MCP

项目根目录包含 `.mcp.json`，配置了 Chrome DevTools MCP：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

如果 Genius Code 会话启用了项目 MCP，可以用 Chrome DevTools 工具打开页面并验证 UI：

```text
http://localhost:5173
```

## 开发验证建议

### 构建验证

```bash
npm run build
```

### 本地启动验证

```bash
npm run dev
```

浏览器打开：

```text
http://localhost:5173
```

### 基础功能验证

1. 点击 `新会话`。
2. 输入模型配置：`API_KEY`、`BaseURL`、`Model`。
3. 输入问题并发送。
4. 确认出现 `正在思考`。
5. 确认思考过程以时间线形式流式展示。
6. 确认思考完成后标题变为 `已完成思考`，并自动收起。
7. 确认最终回答以 Markdown 形式流式输出。
8. 展开 `已完成思考`，确认可以查看完整执行过程。
9. 删除会话，确认会话列表和当前会话切换正常。

### 推荐测试问题

普通销售分析：

```text
帮我设计本周销售复盘的分析框架
```

竞品分析：

```text
帮我做一份竞品分析报告，目标竞品：瓜子二手车
```

闲聊：

```text
你好
```

预期：

- 普通销售分析和闲聊不应强制调用 `web_search`。
- 竞品分析可能选择 `web_search`。
- 当前未接真实搜索 API 时，Observation 应明确说明搜索不可用。
- 最终回答不应声称已完成实时搜索。

## 常见问题

### 1. `Failed to fetch`

当前浏览器不直接请求模型服务，而是请求本地 `/api/chat`。如果仍出现 `Failed to fetch`，请检查：

- `npm run dev` 是否正在运行。
- 页面访问地址是否是本地服务地址。
- `BaseURL` 是否可由本机后端访问。
- `BaseURL` 不要包含 `/chat/completions`，只填基础路径，例如：

```text
https://ark.cn-beijing.volces.com/api/v3
```

### 2. 模型返回鉴权错误

请检查右侧 `API_KEY` 是否正确，以及 `Model` 是否是当前服务可用模型。

### 3. 页面热更新 WebSocket 报错

开发环境中如果看到 Vite HMR WebSocket 端口占用错误，一般只影响热更新，不影响页面和 `/api/chat` 功能。可重启本地服务或释放占用端口。

### 4. npm 权限错误

如果遇到类似：

```text
EACCES: permission denied
```

通常是之前用不同用户或 root 写入了 `node_modules` 或 npm cache。可修复权限：

```bash
sudo chown -R bytedance:staff /Users/bytedance/sales_link
sudo chown -R bytedance:staff /Users/bytedance/.npm
```

### 5. Agent 调用了 `web_search` 但没有真实搜索结果

这是当前版本的预期行为。`web_search` 工具已经注册，但未接入真实 Web Search API。系统会透明说明搜索不可用，不会伪造搜索结果。

## 当前限制

- 没有配置 lint/test/type-check。
- 没有真实 Web Search API。
- 没有接入销售数据源。
- 没有数据库和后端会话持久化。
- API Key 当前保存在浏览器 localStorage，仅适合本地自测。
- ReAct 当前是一轮动态编排，不是多轮无限循环。
- 未接入权限系统、审计日志、用户登录或生产部署配置。

## 后续可扩展方向

- 接入真实 Web Search API。
- 接入销售指标口径、数据源、SQL 查询和看板。
- 支持多轮 ReAct / 工具循环。
- 将会话存储迁移到服务端数据库。
- 增加用户认证和权限控制。
- 增加 Agent trace 审计。
- 拆分前端组件，如 `Sidebar`、`ChatPanel`、`ConfigPanel`、`AgentSteps`、`Composer`。
- 增加测试、lint、type-check。
- 生产环境中将 API Key 从前端配置改为服务端安全配置。

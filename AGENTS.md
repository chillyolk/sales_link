# AGENTS.md

This file provides guidance to Genius Code (ByteCloud) when working with code in this repository.

## Commands

- Install dependencies: `npm install`
- Start local app and API proxy: `npm run dev`
- Build production bundle: `npm run build`
- Start production server after build: `npm run start`
- Preview production bundle: `npm run preview`

There is no test runner configured yet, so there is no single-test command.

## Architecture

SalesLink is a Vite + React single-page application with a small local Express proxy for model calls. It is a sales data analysis Agent; the first version focuses on the conversation experience and basic model configuration rather than data-source integration.

The UI is organized as a three-column shell in `src/main.jsx`:

- Left sidebar: product identity, new conversation button, and local conversation list.
- Center chat panel: active conversation header, message stream, error banner, multiline input, and send button.
- Right config panel: Volcano/OpenAI-compatible model settings for `API_KEY`, `BaseURL`, and `Model`.

State is held in React component state and persisted to `localStorage` under `saleslink-state-v1`. Conversation messages, active conversation ID, and model configuration are all browser-local.

The browser posts chat requests to local `/api/chat`. `server.js` receives `apiKey`, `baseURL`, `model`, and `messages`, then forwards to `${baseURL}/chat/completions` with Bearer auth and an OpenAI-compatible payload. This avoids browser CORS failures from direct model API calls while keeping the first version simple.

Styling lives in `src/styles.css` and is intentionally app-specific: fixed three-column desktop layout, glass-style panels, chat bubbles, and model configuration card.

## Data artifact

`sales_link_ck.xlsx` is an Excel workbook with one sheet, `Sheet1`, containing 109 rows and 12 columns. The first visible columns are `Type`, `Name`, `Key`, and `说明`. The visible rows suggest it describes sales-link dimensions and metrics, for example `attribution_date`, `advertiser_id`, `advertiser_name`, and `customer_id`.

When analyzing the workbook, use Python/openpyxl or another spreadsheet-aware tool because standard text readers cannot read `.xlsx` binary content.

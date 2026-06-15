import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { runReactAgent } from './server/reactAgent.js';
import { prepareSseResponse, sendError } from './server/sse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5173);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));

app.post('/api/chat', async (req, res) => {
  const { apiKey, baseURL, model, messages } = req.body ?? {};

  if (!apiKey?.trim() || !baseURL?.trim() || !model?.trim()) {
    res.status(400).json({ error: '请先完成 API_KEY、BaseURL 和 Model 配置。' });
    return;
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: '消息内容不能为空。' });
    return;
  }

  const controller = new AbortController();
  req.on('aborted', () => controller.abort());

  prepareSseResponse(res);

  try {
    await runReactAgent({
      config: {
        apiKey: apiKey.trim(),
        baseURL: baseURL.trim().replace(/\/+$/, ''),
        model: model.trim(),
      },
      messages,
      res,
      signal: controller.signal,
    });
  } catch (error) {
    sendError(res, error);
    res.end();
  }
});

if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`SalesLink running at http://localhost:${port}`);
});

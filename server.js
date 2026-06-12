import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

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

  const normalizedBaseURL = baseURL.trim().replace(/\/+$/, '');

  try {
    const upstreamResponse = await fetch(`${normalizedBaseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: model.trim(),
        messages: messages.map(({ role, content }) => ({ role, content })),
        temperature: 0.7,
      }),
    });

    const text = await upstreamResponse.text();
    res.status(upstreamResponse.status).type(upstreamResponse.headers.get('content-type') || 'application/json').send(text);
  } catch (error) {
    res.status(502).json({
      error: '本地代理请求模型失败，请检查 BaseURL、网络或模型服务状态。',
      detail: error instanceof Error ? error.message : String(error),
    });
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

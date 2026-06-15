export function parseSseDataBlocks(buffer) {
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? '';
  return {
    rest,
    dataLines: blocks.flatMap((block) => block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim())),
  };
}

export function extractDeltaPayload(payload) {
  const choice = payload?.choices?.[0];
  const delta = choice?.delta ?? {};
  const reasoningText = delta.reasoning_content ?? delta.reasoning ?? delta.reasoning_text ?? delta.thinking ?? delta.thought ?? '';
  const answerText = delta.content ?? '';
  return {
    reasoningText,
    answerText,
    finishReason: choice?.finish_reason,
  };
}

export async function collectModelText({ config, messages, signal, temperature = 0.2 }) {
  const upstreamResponse = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
    }),
  });

  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    throw new Error(text || `模型接口返回 ${upstreamResponse.status}`);
  }

  const data = text ? JSON.parse(text) : null;
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

export async function streamModelAnswer({ config, messages, signal, onAnswer, onThought }) {
  const upstreamResponse = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!upstreamResponse.ok) {
    const detail = await upstreamResponse.text();
    throw new Error(detail || `模型接口返回 ${upstreamResponse.status}`);
  }

  const contentType = upstreamResponse.headers.get('content-type') || '';
  if (!upstreamResponse.body || !contentType.includes('text/event-stream')) {
    const text = await upstreamResponse.text();
    const data = text ? JSON.parse(text) : null;
    const message = data?.choices?.[0]?.message;
    const reasoning = message?.reasoning_content ?? message?.reasoning ?? message?.thinking ?? '';
    const content = message?.content ?? text;
    if (reasoning) onThought?.(reasoning);
    if (content) onAnswer?.(content);
    return;
  }

  const reader = upstreamResponse.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parsed = parseSseDataBlocks(buffer);
    buffer = parsed.rest;

    for (const data of parsed.dataLines) {
      if (!data || data === '[DONE]') return;
      const payload = JSON.parse(data);
      const { reasoningText, answerText, finishReason } = extractDeltaPayload(payload);
      if (reasoningText) onThought?.(reasoningText);
      if (answerText) onAnswer?.(answerText);
      if (finishReason) return;
    }
  }
}

export function parseJsonObject(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('模型没有返回合法 JSON');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

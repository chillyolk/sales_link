export function prepareSseResponse(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
}

export function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function sendError(res, error) {
  sendSse(res, 'error', {
    error: error instanceof Error ? error.message : String(error),
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function streamTextAsStep(res, stepId, text) {
  const chunks = text.match(/.{1,8}/gs) ?? [];
  for (const chunk of chunks) {
    sendSse(res, 'step_delta', { id: stepId, text: chunk });
    await wait(24);
  }
}

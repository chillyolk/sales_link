import { collectModelText, parseJsonObject, streamModelAnswer } from './modelClient.js';
import { buildFinalAnswerMessages, buildJsonRepairMessages, buildReactStepMessages, buildReflectionMessages } from './prompts.js';
import { getToolListForPrompt, runTool } from './tools.js';
import { sendSse, streamTextAsStep } from './sse.js';

async function collectJsonWithRepair({ config, messages, signal }) {
  const text = await collectModelText({ config, messages, signal });
  try {
    return parseJsonObject(text);
  } catch {
    const repairedText = await collectModelText({ config, messages: buildJsonRepairMessages(text), signal, temperature: 0 });
    return parseJsonObject(repairedText);
  }
}

function getLatestUserMessage(messages) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
}

function stringifyAction(action) {
  const tool = action?.tool || 'none';
  const reason = action?.reason ? `原因：${action.reason}` : '';
  const input = action?.input ? `输入：${JSON.stringify(action.input)}` : '';
  return [`工具：${tool}`, reason, input].filter(Boolean).join('\n');
}

function stringifyObservation(observation) {
  if (!observation) return '工具未返回观察结果。';
  if (typeof observation === 'string') return observation;
  return observation.summary || JSON.stringify(observation);
}

async function emitStep(res, { id, type, title, text, extra = {} }) {
  sendSse(res, 'step_start', { id, type, title, ...extra });
  await streamTextAsStep(res, id, text || '');
  sendSse(res, 'step_end', { id, status: 'done' });
}

export async function runReactAgent({ config, messages, res, signal }) {
  const latestUserMessage = getLatestUserMessage(messages);
  sendSse(res, 'status', { phase: 'thinking', text: '开始思考' });

  const reactStep = await collectJsonWithRepair({
    config,
    messages: buildReactStepMessages({
      messages,
      latestUserMessage,
      tools: getToolListForPrompt(),
    }),
    signal,
  });

  const thought = reactStep.thought || '我会先理解你的问题，并规划下一步处理方式。';
  const action = reactStep.action?.tool ? reactStep.action : { tool: 'none', input: {}, reason: '当前问题无需调用外部工具。' };

  await emitStep(res, {
    id: 'thought-1',
    type: 'thought',
    title: '分析',
    text: thought,
  });

  await emitStep(res, {
    id: 'action-1',
    type: 'action',
    title: '行动',
    text: stringifyAction(action),
    extra: { tool: action.tool, input: action.input },
  });

  const observation = await runTool(action);
  await emitStep(res, {
    id: 'observation-1',
    type: 'observation',
    title: '观察',
    text: stringifyObservation(observation),
    extra: { observation },
  });

  const reflectionStep = await collectJsonWithRepair({
    config,
    messages: buildReflectionMessages({ latestUserMessage, thought, action, observation }),
    signal,
  });

  const reflection = {
    reflection: reflectionStep.reflection || '当前过程仍围绕用户目标展开。',
    offTrack: Boolean(reflectionStep.offTrack),
  };

  await emitStep(res, {
    id: 'reflection-1',
    type: 'reflection',
    title: '目标校验',
    text: reflection.reflection,
    extra: { offTrack: reflection.offTrack },
  });

  sendSse(res, 'answer_start', {});

  await streamModelAnswer({
    config,
    signal,
    messages: buildFinalAnswerMessages({ messages, thought, action, observation, reflection }),
    onThought: (text) => sendSse(res, 'thought', { text }),
    onAnswer: (text) => sendSse(res, 'answer', { text }),
  });

  sendSse(res, 'done', { finishReason: 'stop' });
  res.end();
}

export function normalizeMessages(messages) {
  return messages.map(({ role, content }) => ({ role, content })).filter((message) => message.role && message.content);
}

export function buildReactStepMessages({ messages, latestUserMessage, tools }) {
  return [
    {
      role: 'system',
      content: [
        '你是 SalesLink 的 Agent 编排器。',
        '你的任务是根据用户问题生成一轮可展示的 ReAct 步骤。',
        '只输出 JSON，不要 Markdown，不要代码块，不要解释。',
        'thought 是展示给用户的简短任务分析摘要，不要输出隐藏推理链。',
        'action.tool 必须从给定工具列表中选择。',
        '如果用户需要公开实时信息、竞品、行业、公司动态，可选择 web_search。',
        '如果无需工具，可选择 none。',
        '不要编造 observation，observation 由系统工具返回。',
        `可用工具：${JSON.stringify(tools)}`,
        'JSON schema: {"thought":"...","action":{"tool":"none|web_search","input":{},"reason":"..."}}',
      ].join('\n'),
    },
    ...normalizeMessages(messages),
    {
      role: 'user',
      content: `请为这个最新问题生成一轮 ReAct step：${latestUserMessage}`,
    },
  ];
}

export function buildReflectionMessages({ latestUserMessage, thought, action, observation }) {
  return [
    {
      role: 'system',
      content: [
        '你是 SalesLink 的目标校验器。',
        '请根据用户目标、Agent 分析、行动和观察结果，判断当前过程是否跑偏。',
        '只输出 JSON，不要 Markdown，不要代码块。',
        'reflection 是展示给用户看的简短目标校验说明。',
        'JSON schema: {"reflection":"...","offTrack":false}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify({ latestUserMessage, thought, action, observation }),
    },
  ];
}

export function buildFinalAnswerMessages({ messages, thought, action, observation, reflection }) {
  return [
    {
      role: 'system',
      content: [
        '你是 SalesLink，面向销售的数据分析 Agent。',
        '请基于用户问题和 Agent 执行过程，输出最终回答。',
        '最终回答使用 Markdown。',
        '如果工具 observation 显示 web_search 不可用，必须明确说明未接入实时搜索，不能伪造搜索结果或声称已联网检索。',
        '回答要结构清晰、可执行。',
      ].join('\n'),
    },
    ...normalizeMessages(messages),
    {
      role: 'user',
      content: `Agent 执行上下文：${JSON.stringify({ thought, action, observation, reflection })}\n\n请生成最终回答。`,
    },
  ];
}

export function buildJsonRepairMessages(text) {
  return [
    {
      role: 'system',
      content: '请把用户提供的内容修复成合法 JSON。只输出 JSON，不要 Markdown，不要代码块。',
    },
    {
      role: 'user',
      content: text,
    },
  ];
}

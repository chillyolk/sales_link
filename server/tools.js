export const tools = {
  none: {
    name: 'none',
    description: '不调用外部工具，直接基于已有上下文继续。',
    run: async () => ({
      ok: true,
      tool: 'none',
      summary: '当前问题可以基于已有上下文继续处理，无需调用外部工具。',
    }),
  },
  web_search: {
    name: 'web_search',
    description: '搜索公开网页信息。适合竞品、市场、公司动态、公开资料检索。当前版本未配置真实搜索 API。',
    run: async (input = {}) => ({
      ok: false,
      unavailable: true,
      tool: 'web_search',
      query: input.query || '',
      summary: '当前未配置真实 Web Search API，无法获取实时公开网页结果。后续回答将基于模型已有知识和用户提供的信息，并明确标注实时性限制。',
    }),
  },
};

export function getToolListForPrompt() {
  return Object.values(tools).map(({ name, description }) => ({ name, description }));
}

export async function runTool(action = {}) {
  const tool = tools[action.tool] ?? tools.none;
  return tool.run(action.input ?? {});
}

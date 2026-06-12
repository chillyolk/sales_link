import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './styles.css';

const STORAGE_KEY = 'saleslink-state-v1';
const DEFAULT_CONFIG = {
  apiKey: '',
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  model: '',
};

const welcomeMessage = {
  role: 'assistant',
  content: '你好，我是 SalesLink。你可以向我询问销售数据分析思路、指标口径、经营复盘框架或客户洞察方法。',
};

function createConversation() {
  const now = Date.now();
  return {
    id: String(now),
    title: '新的会话',
    createdAt: now,
    messages: [welcomeMessage],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function App() {
  const saved = useMemo(loadState, []);
  const initialConversation = saved?.conversations?.[0] ?? createConversation();
  const [conversations, setConversations] = useState(saved?.conversations?.length ? saved.conversations : [initialConversation]);
  const [activeId, setActiveId] = useState(saved?.activeId ?? initialConversation.id);
  const [config, setConfig] = useState({ ...DEFAULT_CONFIG, ...(saved?.config ?? {}) });
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const activeConversation = conversations.find((item) => item.id === activeId) ?? conversations[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations, activeId, config }));
  }, [conversations, activeId, config]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeConversation?.messages, isSending]);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  function adjustTextareaHeight() {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight);
    const verticalPadding = textarea.offsetHeight - textarea.clientHeight;
    const maxHeight = lineHeight * 4 + verticalPadding;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }

  function handleNewConversation() {
    const conversation = createConversation();
    setConversations((items) => [conversation, ...items]);
    setActiveId(conversation.id);
    setInput('');
    setError('');
  }

  function updateActiveConversation(updater) {
    setConversations((items) => items.map((item) => (item.id === activeConversation.id ? updater(item) : item)));
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || isSending) return;
    if (!config.apiKey.trim() || !config.baseURL.trim() || !config.model.trim()) {
      setError('请先在右侧完成 API_KEY、BaseURL 和 Model 配置。');
      return;
    }

    setError('');
    setInput('');
    setIsSending(true);

    const userMessage = { role: 'user', content };
    const currentMessages = [...activeConversation.messages, userMessage];
    updateActiveConversation((conversation) => ({
      ...conversation,
      title: conversation.title === '新的会话' ? content.slice(0, 18) : conversation.title,
      messages: currentMessages,
    }));

    try {
      const reply = await requestChatCompletion(config, currentMessages);
      updateActiveConversation((conversation) => ({
        ...conversation,
        messages: [...conversation.messages, { role: 'assistant', content: reply }],
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : '调用大模型失败，请检查配置后重试。';
      setError(message);
      updateActiveConversation((conversation) => ({
        ...conversation,
        messages: [...conversation.messages, { role: 'assistant', content: `抱歉，当前模型调用失败：${message}` }],
      }));
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>销数通Agent-自测版</h1>
        </div>
        <button className="new-chat" onClick={handleNewConversation}>+ 新建会话</button>
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`conversation-item ${conversation.id === activeConversation.id ? 'active' : ''}`}
              onClick={() => setActiveId(conversation.id)}
            >
              <span>{conversation.title}</span>
              <small>{conversation.messages.length} 条消息</small>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <h2>{activeConversation.title}</h2>
          <div className="status-pill">{config.model ? `模型：${config.model}` : '未配置模型'}</div>
        </header>

        <div className="message-list" ref={scrollRef}>
          {activeConversation.messages.map((message, index) => (
            <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
              {message.role === 'assistant' ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="bubble">{message.content}</div>
              )}
            </article>
          ))}
          {isSending && (
            <article className="message assistant">
              <div className="markdown-content typing">正在思考中...</div>
            </article>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="composer">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题，例如：帮我设计本周销售复盘的分析框架"
            rows={1}
          />
          <button onClick={handleSend} disabled={isSending || !input.trim()}>{isSending ? '发送中' : '发送'}</button>
        </div>
      </section>

      <aside className="config-panel">
        <div className="config-card">
          <p className="eyebrow">Volcano Model Coding Plan</p>
          <h3>火山大模型配置</h3>
          <label>
            <span>API_KEY</span>
            <input
              type="password"
              value={config.apiKey}
              onChange={(event) => setConfig((item) => ({ ...item, apiKey: event.target.value }))}
              placeholder="输入 API Key"
            />
          </label>
          <label>
            <span>BaseURL</span>
            <input
              value={config.baseURL}
              onChange={(event) => setConfig((item) => ({ ...item, baseURL: event.target.value }))}
              placeholder="https://ark.cn-beijing.volces.com/api/v3"
            />
          </label>
          <label>
            <span>Model</span>
            <input
              value={config.model}
              onChange={(event) => setConfig((item) => ({ ...item, model: event.target.value }))}
              placeholder="输入模型 ID"
            />
          </label>
          <p className="hint">配置保存在当前浏览器本地。前端请求本地 `/api/chat`，再由本地服务按 OpenAI-compatible `/chat/completions` 格式转发。</p>
        </div>
      </aside>
    </main>
  );
}

async function requestChatCompletion(config, messages) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: config.apiKey.trim(),
      baseURL: config.baseURL.trim(),
      model: config.model.trim(),
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || text || `模型接口返回 ${response.status}`);
  }

  return data?.choices?.[0]?.message?.content?.trim() || '模型没有返回可展示的内容。';
}

createRoot(document.getElementById('root')).render(<App />);

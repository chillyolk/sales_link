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

  function handleDeleteConversation(event, conversationId) {
    event.stopPropagation();

    setConversations((items) => {
      if (items.length === 1) {
        const conversation = createConversation();
        setActiveId(conversation.id);
        return [conversation];
      }

      const nextConversations = items.filter((item) => item.id !== conversationId);
      if (conversationId === activeConversation.id) {
        setActiveId(nextConversations[0].id);
      }
      return nextConversations;
    });
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
          <svg t="1781357925246" className="brand-avatar" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" aria-hidden="true" focusable="false">
            <path d="M521.660377 57.962264a96.603774 96.603774 0 0 1 28.981132 188.763774V405.735849h-57.962264v-159.009811A96.642415 96.642415 0 0 1 521.660377 57.962264z" fill="#333C50"></path>
            <path d="M193.207547 463.698113a154.566038 154.566038 0 0 1 154.566038-154.566038h367.09434a154.566038 154.566038 0 0 1 154.566037 154.566038v251.169812a154.566038 154.566038 0 0 1-154.566037 154.566037h-144.905661a226.477887 226.477887 0 0 1-185.537207 96.603774h-49.345208a19.320755 19.320755 0 0 1-16.210113-29.850566L362.264151 869.433962H347.773585a154.566038 154.566038 0 0 1-154.566038-154.566037V463.698113z" fill="#64EDAC"></path>
            <path d="M908.075472 463.698113a96.603774 96.603774 0 0 1 96.603773 96.603774v77.283019a96.603774 96.603774 0 0 1-96.603773 96.603773V463.698113zM154.566038 734.188679a96.603774 96.603774 0 0 1-96.603774-96.603773v-77.283019a96.603774 96.603774 0 0 1 96.603774-96.603774v270.490566zM599.136604 654.471245a28.981132 28.981132 0 0 1 38.525585 43.297812L618.264151 676.226415c19.378717 21.542642 19.359396 21.561962 19.359396 21.561962l-0.057962 0.057963-0.115925 0.096603-0.251169 0.193208-0.618265 0.579623a106.805132 106.805132 0 0 1-8.153358 6.066717c-5.255245 3.535698-12.732377 7.998792-22.412076 12.365283-19.494642 8.771623-47.683623 17.040906-84.354415 17.040905-36.670792 0-64.859774-8.269283-84.335094-17.040905a150.837132 150.837132 0 0 1-22.431396-12.365283 106.805132 106.805132 0 0 1-8.153359-6.086038c-0.25117-0.193208-0.444377-0.386415-0.618264-0.540981l-0.25117-0.212529-0.115924-0.096603-0.057962-0.057963S405.677887 697.769057 425.056604 676.226415l-19.398038 21.542642a28.981132 28.981132 0 0 1 38.66083-43.181887v-0.038642l-0.135245-0.077283-0.057962-0.077283 0.367094 0.309132c0.483019 0.386415 1.410415 1.101283 2.801509 2.02868 2.801509 1.893434 7.399849 4.675623 13.795019 7.535094 12.732377 5.738264 32.845283 11.959547 60.570566 11.959547 27.725283 0 47.838189-6.221283 60.570566-11.940226 6.39517-2.898113 11.01283-5.660981 13.795019-7.535095 1.391094-0.966038 2.318491-1.680906 2.80151-2.048l0.367094-0.309132-0.057962 0.077283zM386.415094 463.698113c21.349434 0 38.641509 25.947774 38.64151 57.962264s-17.292075 57.962264-38.64151 57.962265-38.641509-25.947774-38.641509-57.962265 17.292075-57.962264 38.641509-57.962264z m270.490566 0c21.349434 0 38.641509 25.947774 38.64151 57.962264s-17.292075 57.962264-38.64151 57.962265-38.641509-25.947774-38.641509-57.962265 17.292075-57.962264 38.641509-57.962264z" fill="#333C50"></path>
          </svg>
          <h1>销数通Agent-自测版</h1>
        </div>
        <button className="new-chat" onClick={handleNewConversation}>
          <svg t="1781357164668" className="new-chat-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" aria-hidden="true" focusable="false">
            <path d="M422.4 473.6h307.2a38.4 38.4 0 1 1 0 76.8H422.4a38.4 38.4 0 1 1 0-76.8" fill="#515151"></path>
            <path d="M614.4 358.4v307.2a38.4 38.4 0 1 1-76.8 0V358.4a38.4 38.4 0 1 1 76.8 0" fill="#515151"></path>
            <path d="M568.64 960a456.704 456.704 0 0 1-344.448-155.2L0 768.32l108.8-130.368a39.744 39.744 0 0 1 55.424-5.312 38.272 38.272 0 0 1 5.376 54.464l-22.464 26.88 119.04 19.392 9.344 11.392a377.856 377.856 0 0 0 293.12 137.984c207.808 0 376.832-166.272 376.832-370.688s-169.024-370.688-376.832-370.688c-185.856 0-342.272 130.752-371.84 310.912a39.04 39.04 0 0 1-45.12 32 38.784 38.784 0 0 1-32.512-44.288C154.88 222.08 344 64 568.64 64 819.84 64 1024 264.96 1024 512s-204.224 448-455.36 448z" fill="#515151"></path>
          </svg>
          <span>新会话</span>
        </button>
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`conversation-item ${conversation.id === activeConversation.id ? 'active' : ''}`}
              onClick={() => setActiveId(conversation.id)}
            >
              <span className="conversation-title">
                <svg t="1781359418599" className="conversation-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="200" height="200" aria-hidden="true" focusable="false">
                  <path d="M512 164.864c12.8 0 26.112 0.512 38.912 2.048 163.328 17.92 294.4 153.6 307.2 317.44 5.632 71.168-10.24 138.24-41.984 195.072-15.872 28.16-13.824 63.488 2.56 91.648l27.648 47.616c10.24 17.92-2.56 40.448-23.552 40.448h-286.208l0.512-1.024c-8.192 0.512-16.896 1.024-25.088 1.024-23.552 0-46.592-2.56-69.632-7.68-142.336-30.72-254.976-147.456-274.432-291.328-28.672-212.992 136.704-395.264 344.064-395.264m0-100.864c-129.024 0-251.904 55.808-336.896 153.088S51.2 443.904 68.608 573.44c24.576 184.832 166.4 335.872 352.256 376.32 30.208 6.656 60.928 9.728 91.136 9.728 5.632 0 10.752 0 16.384-0.512 2.56 0 5.12 0.512 8.192 0.512h286.208c45.568 0 87.552-24.576 110.592-64 22.528-39.424 22.528-88.064 0-127.488l-26.112-45.056c40.448-74.752 58.368-160.256 51.712-246.272-15.872-210.432-186.368-386.56-396.288-409.6-17.408-2.048-34.304-3.072-50.688-3.072z" fill="#707070"></path>
                  <path d="M281.088 512c0 27.648 22.528 50.176 50.176 50.176s50.176-22.528 50.176-50.176-22.528-50.176-50.176-50.176-50.176 22.528-50.176 50.176zM461.824 512c0 27.648 22.528 50.176 50.176 50.176s50.176-22.528 50.176-50.176-22.528-50.176-50.176-50.176-50.176 22.528-50.176 50.176zM642.048 512c0 27.648 22.528 50.176 50.176 50.176s50.176-22.528 50.176-50.176-22.528-50.176-50.176-50.176c-27.136-0.512-49.664 22.016-50.176 50.176z" fill="#707070"></path>
                </svg>
                <span className="conversation-name">{conversation.title}</span>
              </span>
              <span
                className="conversation-delete"
                role="button"
                tabIndex={0}
                aria-label={`删除会话 ${conversation.title}`}
                onClick={(event) => handleDeleteConversation(event, conversation.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    handleDeleteConversation(event, conversation.id);
                  }
                }}
              >
                ×
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-panel">
        <header className="chat-header">
          <h2>{activeConversation.title}</h2>
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

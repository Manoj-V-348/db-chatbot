import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { aggregateByIntent } from '../lib/data';
import {
  formatCollectionList,
  formatCollectionName,
  formatINR,
  formatMetricLabel,
  isCurrencyMetric,
} from '../lib/format';
import { execute } from '../lib/executor';
import { parseWithAI } from '../lib/ai-parser';
import { generateNaturalResponse } from '../lib/ai-responder';
import type { Intent, CampusRecord } from '../lib/types';
import type { ExecutionResult } from '../lib/executor';

type MessageBase = {
  id: string;
  role: 'user' | 'assistant';
};

type UserMessage = MessageBase & {
  role: 'user';
  text: string;
};

type AssistantTextMessage = MessageBase & {
  role: 'assistant';
  type: 'text';
  text: string;
};

type AssistantResultMessage = MessageBase & {
  role: 'assistant';
  type: 'result';
  intent: Intent;
  timestamp: string;
  hasData: boolean;
  summary: ReturnType<typeof aggregateByIntent>;
  execution: ExecutionResult;
  detailedRecords?: CampusRecord[]; // For queries with sort/limit
  aiResponse?: string; // Natural language response from OpenAI
};

type AssistantErrorMessage = MessageBase & {
  role: 'assistant';
  type: 'error';
  text: string;
};

type Message = UserMessage | AssistantTextMessage | AssistantResultMessage | AssistantErrorMessage;

const STATUS_COPY: Record<Intent['status'], string> = {
  active: 'Active only',
  inactive: 'Inactive only',
  any: 'Any status',
};

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function formatValue(metric: Intent['metric'], value: number): string {
  if (isCurrencyMetric(metric)) {
    return formatINR(value);
  }

  return new Intl.NumberFormat('en-IN').format(value);
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString('en-IN', {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: createId(),
      role: 'assistant',
      type: 'text',
      text: 'Hi! I\'m your AI-powered financial assistant. Ask me anything about your campus finances in plain English. For example: "Which is my highest profitable school?" or "Show me top 5 colleges by income" or "What\'s the total expenditure across all institutions?"',
    } satisfies AssistantTextMessage,
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!viewportRef.current) {
      return;
    }
    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: UserMessage = {
      id: createId(),
      role: 'user',
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Step 1: Parse user query with AI
      const intent = await parseWithAI(trimmed);

      // Step 2: Execute the query
      const execution = await execute(intent);
      const summary = aggregateByIntent(execution.records, intent);

      const hasData = execution.records.length > 0;

      // Step 3: Generate natural language response
      let aiResponse: string | undefined;
      try {
        aiResponse = await generateNaturalResponse(trimmed, intent, execution);
      } catch (aiError) {
        console.error('AI response generation failed:', aiError);
        // Continue without AI response - will still show data cards
      }

      // Include detailed records if sorting/limiting was requested
      const detailedRecords = intent.sort || intent.limit ? execution.records : undefined;

      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          type: 'result',
          intent,
          timestamp: new Date().toISOString(),
          hasData,
          summary,
          execution,
          detailedRecords,
          aiResponse,
        } satisfies AssistantResultMessage,
      ]);
    } catch (error) {
      console.error('Chat intent handling failed', error);
      const errorMessage = error instanceof Error ? error.message : 'Something went wrong while fetching data. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          type: 'error',
          text: errorMessage,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const placeholder = useMemo(
    () => 'Ask me anything... e.g., "Which is my most profitable school?"',
    [],
  );

  return (
    <section className="flex h-full flex-col gap-6">
      {/* Chat header with instructions */}
      <div className="glass-card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-soft shadow-glow-sm">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Ask About Your Data</h2>
            <p className="mt-1 text-sm text-slate-400">
              Query financial metrics across all institutions using natural language. Try asking about income, expenses, or profit by collection.
            </p>
          </div>
        </div>
      </div>

      {/* Messages container */}
      <div
        ref={viewportRef}
        className="glass-card relative flex-1 overflow-y-auto p-6 md:p-8"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
          {messages.map((message) => {
            if (message.role === 'user') {
              return (
                <article
                  key={message.id}
                  className="group ml-auto flex max-w-full items-start gap-3 md:max-w-[85%]"
                >
                  <div className="flex-1 rounded-2xl rounded-tr-sm bg-gradient-to-br from-accent to-accent-soft px-5 py-4 shadow-pill">
                    <p className="text-sm font-medium leading-relaxed text-white">{message.text}</p>
                  </div>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-ink shadow-md">
                    You
                  </div>
                </article>
              );
            }

            if (message.type === 'text') {
              return (
                <article
                  key={message.id}
                  className="mr-auto flex max-w-full items-start gap-3 md:max-w-[85%]"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-soft to-accent shadow-glow-sm">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-sm border border-white/10 bg-white/8 px-5 py-4 text-sm leading-relaxed text-slate-200 shadow-md backdrop-blur-xl">
                    {message.text}
                  </div>
                </article>
              );
            }

            if (message.type === 'error') {
              return (
                <article
                  key={message.id}
                  className="mr-auto flex max-w-full items-start gap-3 md:max-w-[85%]"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-error/20">
                    <svg className="h-5 w-5 text-error-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-sm border border-error/40 bg-error/10 px-5 py-4 text-sm font-medium text-error-light shadow-md backdrop-blur-xl">
                    {message.text}
                  </div>
                </article>
              );
            }

            const { intent, summary, hasData, timestamp, execution, detailedRecords, aiResponse } = message;
            const metricLabel = formatMetricLabel(intent.metric);
            const headline = `${metricLabel} — ${formatCollectionList(intent.collections)}`;

            return (
              <article
                key={message.id}
                className="mr-auto flex w-full max-w-full flex-col gap-3"
              >
                {/* AI Natural Language Response */}
                {aiResponse && (
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-soft to-accent shadow-glow-sm">
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                      </svg>
                    </div>
                    <div className="flex-1 rounded-2xl rounded-tl-sm border border-accent/30 bg-gradient-to-br from-accent/10 to-accent/5 px-5 py-4 text-base leading-relaxed text-white shadow-glow-sm backdrop-blur-xl">
                      {aiResponse}
                    </div>
                  </div>
                )}

                {/* Detailed Data Card */}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-soft to-accent shadow-glow-sm">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  </div>

                  <div
                    className={`flex-1 overflow-hidden rounded-2xl rounded-tl-sm border bg-white/8 shadow-elevation backdrop-blur-xl ${
                      !hasData ? 'border-dashed border-warning/30' : 'border-white/10'
                    }`}
                  >
                  {/* Card header */}
                  <div className="border-b border-white/10 bg-white/5 px-6 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="text-sm font-semibold text-white">{headline}</h3>
                      <time className="text-xs text-slate-400">{formatTimestamp(timestamp)}</time>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-6">
                    <div className="space-y-6">
                      {/* Total value display */}
                      <div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Value</span>
                          <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                        </div>
                        <p className="text-4xl font-bold tracking-tight text-white">
                          {formatValue(intent.metric, summary.total)}
                        </p>
                        {!hasData && (
                          <p className="mt-3 flex items-center gap-2 text-sm text-warning-light">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                            </svg>
                            No matching data found
                          </p>
                        )}
                      </div>

                      {/* Breakdown section */}
                      {intent.breakdown === 'collection' && summary.breakdown.length > 0 && hasData && (
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">By Collection</span>
                            <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {summary.breakdown.map((item) => (
                              <div
                                key={item.collection}
                                className="group relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 transition-all duration-300 hover:border-accent/30 hover:shadow-pill-soft"
                              >
                                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                  {formatCollectionName(item.collection)}
                                </dt>
                                <dd className="mt-2 text-xl font-bold text-white">
                                  {formatValue(intent.metric, item.value)}
                                </dd>
                                <div className="absolute right-0 top-0 h-full w-1 bg-gradient-to-b from-accent to-accent-soft opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Detailed records section (for sorted/limited queries) */}
                      {detailedRecords && detailedRecords.length > 0 && (
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                              {intent.sort === 'desc' ? 'Top Results' : 'Results'}
                            </span>
                            <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent"></div>
                          </div>
                          <div className="space-y-2">
                            {detailedRecords.map((record, index) => (
                              <div
                                key={record.id}
                                className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 transition-all hover:border-accent/30 hover:bg-white/8"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/20 text-xs font-bold text-accent-light">
                                    {index + 1}
                                  </span>
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {record.name || record.code}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {formatCollectionName(record.__collection)}
                                      {record.type && ` · ${record.type}`}
                                      {' · '}
                                      {record.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-white">
                                    {formatValue(intent.metric,
                                      intent.metric === 'profit' ? record.profit :
                                      intent.metric === 'expenditure' ? record.expenditure :
                                      intent.metric === 'income' ? record.income :
                                      intent.metric === 'salary' ? record.salary :
                                      intent.metric === 'rent' ? record.rent :
                                      intent.metric === 'electricity' ? record.electricity :
                                      intent.metric === 'misc' ? record.misc :
                                      record.staff
                                    )}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card footer with metadata */}
                  <div className="border-t border-white/5 bg-white/[0.02] px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium text-slate-300">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        {execution.docsRead} docs read
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium text-slate-300">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {execution.records.length} returned
                      </span>
                      {execution.usedIndexes && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/20 px-3 py-1.5 font-medium text-success-light">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                          </svg>
                          Optimized
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium text-slate-300">
                        {STATUS_COPY[intent.status]}
                      </span>
                    </div>
                  </div>
                </div>
                </div>
              </article>
            );
          })}

          {isLoading && (
            <article className="mr-auto flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-soft to-accent shadow-glow-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-5 py-4 text-sm font-medium text-slate-200 shadow-md backdrop-blur-xl">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
                Analyzing your query...
              </div>
            </article>
          )}
        </div>
      </div>

      {/* Enhanced input form */}
      <form
        onSubmit={handleSubmit}
        className="glass-card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask a question about your financial data
        </label>
        <div className="relative flex-1">
          <input
            id="chat-input"
            name="chat-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
            className="input-field h-14 w-full pr-12 text-base"
            disabled={isLoading}
            autoComplete="off"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-ink"
              aria-label="Clear input"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          type="submit"
          className="btn-primary h-14 px-8"
          disabled={isLoading || !input.trim()}
        >
          <span className="flex items-center gap-2">
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Processing
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Send
              </>
            )}
          </span>
        </button>
      </form>
    </section>
  );
}

export default Chat;

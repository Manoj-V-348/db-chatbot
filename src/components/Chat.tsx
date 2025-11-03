import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { aggregateByIntent } from '../lib/data';
import {
  formatCollectionName,
  formatINR,
  isCurrencyMetric,
} from '../lib/format';
import { execute } from '../lib/executor';
import { parseWithAI, isCrossCollectionQuery } from '../lib/ai-parser';
import type { Intent, CampusRecord, AggregateBreakdown } from '../lib/types';
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

// Multi-step message types
type AssistantUnderstandingMessage = MessageBase & {
  role: 'assistant';
  type: 'understanding';
  userQuery: string;
  interpretation: string;
  expectedOutputs: number;
  datasetType: 'finance' | 'sports' | 'education' | 'cross-collection';
};

type QueryPlan = {
  collection: string;
  query: string[];
  description: string;
};

type AssistantQueryPlanMessage = MessageBase & {
  role: 'assistant';
  type: 'query-plan';
  intent: Intent;
  queryPlans: QueryPlan[];
  willUseIndexes: boolean;
};

type AssistantExecutionMessage = MessageBase & {
  role: 'assistant';
  type: 'execution';
  status: 'running' | 'completed';
  progress?: string;
};

type AssistantDetailedResultMessage = MessageBase & {
  role: 'assistant';
  type: 'detailed-result';
  intent: Intent;
  timestamp: string;
  hasData: boolean;
  summary: ReturnType<typeof aggregateByIntent>;
  execution: ExecutionResult;
  detailedRecords?: CampusRecord[]; // For queries with sort/limit
  breakdown: any[]; // Detailed breakdown for verification
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

type Message =
  | UserMessage
  | AssistantTextMessage
  | AssistantUnderstandingMessage
  | AssistantQueryPlanMessage
  | AssistantExecutionMessage
  | AssistantDetailedResultMessage
  | AssistantResultMessage
  | AssistantErrorMessage;

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

// Helper function to determine dataset type from metric
function getDatasetType(metric: Intent['metric']): 'finance' | 'sports' | 'education' {
  const sportsMetrics: Intent['metric'][] = ['medals', 'coaches', 'events', 'teams', 'sports_budget'];
  const educationMetrics: Intent['metric'][] = ['students', 'teachers', 'pass_rate', 'avg_grade', 'dropout_rate'];

  if (sportsMetrics.includes(metric)) return 'sports';
  if (educationMetrics.includes(metric)) return 'education';
  return 'finance';
}

// Helper function to generate understanding interpretation
function generateInterpretation(_userQuery: string, intent: Intent): string {
  const datasetType = getDatasetType(intent.metric);
  const metricName = intent.metric.replace(/_/g, ' ');
  const collections = intent.collections.join(', ');

  let interpretation = `You want to query ${metricName} data from the ${datasetType} dataset across ${intent.collections.length} collection(s): ${collections}.`;

  if (intent.status !== 'any') {
    interpretation += ` Filtering for ${intent.status} records only.`;
  }

  if (intent.typeFilter) {
    interpretation += ` Filtering for type: ${intent.typeFilter}.`;
  }

  if (intent.locationFilter) {
    interpretation += ` Filtering for location containing: "${intent.locationFilter}".`;
  }

  if (intent.sort) {
    interpretation += ` Results will be sorted in ${intent.sort === 'desc' ? 'descending' : 'ascending'} order.`;
  }

  if (intent.limit) {
    interpretation += ` Limiting results to top ${intent.limit}.`;
  }

  return interpretation;
}

// Helper function to generate query plans with syntax highlighting
function generateQueryPlans(intent: Intent): QueryPlan[] {
  const plans: QueryPlan[] = [];

  for (const collection of intent.collections) {
    const queryLines: string[] = [];

    queryLines.push(`<div class="text-blue-400">db.collection(<span class="text-orange-400">"${collection}"</span>)</div>`);

    if (intent.status !== 'any') {
      queryLines.push(`<div class="pl-4 text-purple-400">.where(<span class="text-orange-400">"status"</span>, <span class="text-orange-400">"=="</span>, <span class="text-orange-400">"${intent.status}"</span>)</div>`);
    }

    if (intent.typeFilter) {
      queryLines.push(`<div class="pl-4 text-purple-400">.where(<span class="text-orange-400">"type"</span>, <span class="text-orange-400">"=="</span>, <span class="text-orange-400">"${intent.typeFilter}"</span>)</div>`);
    }

    if (intent.locationFilter) {
      queryLines.push(`<div class="pl-4 text-purple-400">.where(<span class="text-orange-400">"location"</span>, <span class="text-orange-400">"contains"</span>, <span class="text-orange-400">"${intent.locationFilter}"</span>)</div>`);
    }

    if (intent.sort) {
      queryLines.push(`<div class="pl-4 text-green-400">.orderBy(<span class="text-orange-400">"${intent.metric}"</span>, <span class="text-orange-400">"${intent.sort}"</span>)</div>`);
    }

    if (intent.limit) {
      queryLines.push(`<div class="pl-4 text-yellow-400">.limit(<span class="text-orange-400">${intent.limit}</span>)</div>`);
    }

    queryLines.push(`<div class="pl-4 text-slate-400">.get()</div>`);

    let description = `Query ${collection} collection`;
    if (intent.status !== 'any' || intent.typeFilter || intent.locationFilter) {
      description += ' with filters';
    }
    if (intent.sort) {
      description += ` and sort by ${intent.metric}`;
    }

    plans.push({
      collection,
      query: queryLines,
      description,
    });
  }

  return plans;
}

// Helper function to determine if query will use indexes
function willUseIndexes(intent: Intent): boolean {
  const indexedMetrics: Intent['metric'][] = ['income', 'rent', 'salary', 'electricity', 'misc'];
  return indexedMetrics.includes(intent.metric) && intent.sort !== undefined;
}

// Helper function to create breakdown data
function createBreakdown(records: CampusRecord[], intent: Intent): any[] {
  return records.map(record => {
    const breakdown: any = {
      CODE: record.code,
      NAME: record.name || 'N/A',
      LOCATION: record.location || 'N/A',
      TYPE: record.type || 'N/A',
      STATUS: record.status.toUpperCase(),
    };

    // Add metric-specific fields
    const datasetType = getDatasetType(intent.metric);
    if (datasetType === 'finance') {
      breakdown.RENT = formatINR(record.rent);
      breakdown.SALARY = formatINR(record.salary);
      breakdown.ELECTRICITY = formatINR(record.electricity);
      breakdown.MISC = formatINR(record.misc);
      breakdown.INCOME = formatINR(record.income);
      breakdown.EXPENDITURE = formatINR(record.expenditure);
      breakdown.PROFIT = formatINR(record.profit);
    } else if (datasetType === 'sports') {
      if ((record as any).medals !== undefined) breakdown.MEDALS = (record as any).medals;
      if ((record as any).coaches !== undefined) breakdown.COACHES = (record as any).coaches;
      if ((record as any).events !== undefined) breakdown.EVENTS = (record as any).events;
      if ((record as any).teams !== undefined) breakdown.TEAMS = (record as any).teams;
      if ((record as any).budget !== undefined) breakdown.SPORTS_BUDGET = formatINR((record as any).budget);
    } else if (datasetType === 'education') {
      if ((record as any).students !== undefined) breakdown.STUDENTS = (record as any).students;
      if ((record as any).teachers !== undefined) breakdown.TEACHERS = (record as any).teachers;
      if ((record as any).pass_rate !== undefined) breakdown.PASS_RATE = `${(record as any).pass_rate}%`;
      if ((record as any).avg_grade !== undefined) breakdown.AVG_GRADE = (record as any).avg_grade;
      if ((record as any).dropout_rate !== undefined) breakdown.DROPOUT_RATE = `${(record as any).dropout_rate}%`;
    }

    return breakdown;
  });
}

export function Chat() {
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: createId(),
      role: 'assistant',
      type: 'text',
      text: 'Hi! I\'m Varsity Chat, your AI-powered institutional data assistant. Ask me anything about your finances, sports, and education data in plain English.\n\nExamples:\n• "Which is my highest profitable school?"\n• "Show me top 3 schools by number of medals"\n• "What is the pass rate for TS Hyderabad East Maredpally?"\n• "Compare medals and pass rate across all schools"',
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
      // MULTI-STEP WORKFLOW

      // STEP 1: Understanding Phase
      // Parse user query with AI first to understand intent
      const intent = await parseWithAI(trimmed);
      const datasetType = isCrossCollectionQuery(trimmed) ? 'cross-collection' : getDatasetType(intent.metric);
      const interpretation = generateInterpretation(trimmed, intent);
      const expectedOutputs = intent.collections.length;

      // Add Step 1 message
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          type: 'understanding',
          userQuery: trimmed,
          interpretation,
          expectedOutputs,
          datasetType,
        } satisfies AssistantUnderstandingMessage,
      ]);

      // Small delay for user to see the understanding
      await new Promise(resolve => setTimeout(resolve, 500));

      // STEP 2: Query Planning Phase
      const queryPlans = generateQueryPlans(intent);
      const indexesWillBeUsed = willUseIndexes(intent);

      // Add Step 2 message
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          type: 'query-plan',
          intent,
          queryPlans,
          willUseIndexes: indexesWillBeUsed,
        } satisfies AssistantQueryPlanMessage,
      ]);

      // Small delay for user to see the query plan
      await new Promise(resolve => setTimeout(resolve, 500));

      // STEP 3: Execution Phase
      // Add execution message with running status
      const executionMsgId = createId();
      setMessages((prev) => [
        ...prev,
        {
          id: executionMsgId,
          role: 'assistant',
          type: 'execution',
          status: 'running',
          progress: 'Executing Firestore queries...',
        } satisfies AssistantExecutionMessage,
      ]);

      // Execute the query
      const execution = await execute(intent);
      const summary = aggregateByIntent(execution.records, intent);
      const hasData = execution.records.length > 0;

      // Update execution message to completed
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === executionMsgId && msg.role === 'assistant' && msg.type === 'execution'
            ? {
                ...msg,
                status: 'completed' as const,
                progress: `Completed - ${execution.records.length} records returned`,
              }
            : msg
        )
      );

      // Small delay for user to see completion
      await new Promise(resolve => setTimeout(resolve, 500));

      // STEP 4: Detailed Results Display
      const breakdown = createBreakdown(execution.records, intent);
      const detailedRecords = intent.sort || intent.limit ? execution.records : undefined;

      // Add Step 4 message with detailed results
      setMessages((prev) => [
        ...prev,
        {
          id: createId(),
          role: 'assistant',
          type: 'detailed-result',
          intent,
          timestamp: new Date().toISOString(),
          hasData,
          summary,
          execution,
          detailedRecords,
          breakdown,
        } satisfies AssistantDetailedResultMessage,
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
              Query financial, sports, and education metrics across all institutions using natural language. Compare data, filter by location, or analyze specific metrics.
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

            // Step 1: Understanding Phase
            if (message.type === 'understanding') {
              return (
                <article
                  key={message.id}
                  className="mr-auto flex w-full max-w-full items-start gap-3"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-glow-sm">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1 overflow-hidden rounded-2xl rounded-tl-sm border border-blue-400/30 bg-gradient-to-br from-blue-500/10 to-blue-600/5 shadow-md backdrop-blur-xl">
                    <div className="border-b border-blue-400/20 bg-blue-500/10 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-300">Step 1: Understanding</span>
                      </div>
                    </div>
                    <div className="p-5 text-sm leading-relaxed text-slate-200">
                      <div className="space-y-3">
                        <div>
                          <span className="font-semibold text-blue-300">Query:</span>
                          <p className="mt-1 text-white">{message.userQuery}</p>
                        </div>
                        <div>
                          <span className="font-semibold text-blue-300">My Understanding:</span>
                          <p className="mt-1 text-slate-200">{message.interpretation}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1.5 font-medium text-blue-300">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                            </svg>
                            Dataset: {message.datasetType}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 px-3 py-1.5 font-medium text-blue-300">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            {message.expectedOutputs} {message.expectedOutputs === 1 ? 'output' : 'outputs'} expected
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            }

            // Step 2: Query Planning Phase
            if (message.type === 'query-plan') {
              return (
                <article
                  key={message.id}
                  className="mr-auto flex w-full max-w-full items-start gap-3"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-600 shadow-glow-sm">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                  <div className="flex-1 overflow-hidden rounded-2xl rounded-tl-sm border border-purple-400/30 bg-gradient-to-br from-purple-500/10 to-purple-600/5 shadow-md backdrop-blur-xl">
                    <div className="border-b border-purple-400/20 bg-purple-500/10 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-purple-300">Step 2: Query Planning</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="space-y-4">
                        {message.queryPlans.map((plan, index) => (
                          <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-purple-300">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                              </svg>
                              {plan.collection}
                            </div>
                            <div className="mb-2 text-xs text-slate-400">{plan.description}</div>
                            <div className="space-y-1 font-mono text-[11px] leading-relaxed">
                              {plan.query.map((line, lineIndex) => (
                                <div key={lineIndex} dangerouslySetInnerHTML={{ __html: line }} />
                              ))}
                            </div>
                          </div>
                        ))}
                        {message.willUseIndexes && (
                          <div className="flex items-center gap-1.5 text-xs text-success-light">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Will use Firestore composite indexes for optimal performance
                          </div>
                        )}
                        {!message.willUseIndexes && (
                          <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                            Will use client-side processing for computed metrics
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            }

            // Step 3: Execution Phase
            if (message.type === 'execution') {
              return (
                <article
                  key={message.id}
                  className="mr-auto flex items-start gap-3"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-amber-600 shadow-glow-sm">
                    {message.status === 'running' ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    ) : (
                      <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-amber-600/5 px-5 py-4 text-sm font-medium shadow-md backdrop-blur-xl">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden />
                    <span className="text-amber-200">
                      <span className="font-bold text-amber-100">Step 3:</span> {message.progress || 'Executing queries...'}
                    </span>
                  </div>
                </article>
              );
            }

            // Step 4: Detailed Results (new multi-step format)
            if (message.type === 'detailed-result') {
              const { intent, summary, execution, breakdown } = message;

              return (
                <article
                  key={message.id}
                  className="mr-auto flex w-full max-w-full items-start gap-3"
                >
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-success to-success-dark shadow-glow-sm">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                    </svg>
                  </div>
                  <div className="flex-1 overflow-hidden rounded-2xl rounded-tl-sm border border-success/30 bg-gradient-to-br from-success/10 to-success-dark/5 shadow-md backdrop-blur-xl">
                    <div className="border-b border-success/20 bg-success/10 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-success-light">Step 4: Detailed Results</span>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="space-y-4">
                        {/* Detailed breakdown */}
                        {breakdown && breakdown.length > 0 && (
                          <div className="rounded-lg border border-white/10 bg-black/20 p-4 font-mono text-xs">
                            {breakdown.map((item: any, index: number) => (
                              <div key={index} className="mb-4 border-b border-slate-700 pb-4 last:mb-0 last:border-0 last:pb-0">
                                {Object.entries(item).map(([key, value]) => (
                                  <div key={key} className="flex justify-between py-1">
                                    <span className="text-slate-400">{key}:</span>
                                    <span className="text-white">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Summary */}
                        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                          <div className="text-sm font-semibold text-success-light">Total: {formatValue(intent.metric, summary.total)}</div>
                          {intent.breakdown === 'collection' && summary.breakdown.length > 0 && (
                            <div className="mt-2 space-y-1 text-xs">
                              {summary.breakdown.map((item: AggregateBreakdown) => (
                                <div key={item.collection} className="flex justify-between text-slate-300">
                                  <span>{formatCollectionName(item.collection)}:</span>
                                  <span>{formatValue(intent.metric, item.value)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-2 text-xs">
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
            }

            // Legacy result message (keep for backward compatibility during transition)
            if (message.type === 'result') {
              const { intent, summary, hasData, execution, detailedRecords, aiResponse } = message;

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

                  {/* Query Details Section */}
                  <div className="border-t border-white/5 bg-white/[0.02] px-6 py-4">
                    <details className="group">
                      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-300">
                        <svg className="h-4 w-4 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        Database Query
                      </summary>
                      <div className="mt-3 space-y-3 text-xs">
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="mb-2 flex items-center gap-2 font-semibold text-accent-light">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                            </svg>
                            Firestore Query
                          </div>
                          <div className="space-y-1 font-mono text-[11px] leading-relaxed text-slate-300">
                            <div className="text-blue-400">db.collection(<span className="text-orange-400">"{intent.collections[0]}"</span>)</div>
                            {intent.status !== 'any' && (
                              <div className="pl-4 text-purple-400">.where(<span className="text-orange-400">"status"</span>, <span className="text-orange-400">"=="</span>, <span className="text-orange-400">"{intent.status}"</span>)</div>
                            )}
                            {intent.typeFilter && (
                              <div className="pl-4 text-purple-400">.where(<span className="text-orange-400">"type"</span>, <span className="text-orange-400">"=="</span>, <span className="text-orange-400">"{intent.typeFilter}"</span>)</div>
                            )}
                            {intent.locationFilter && (
                              <div className="pl-4 text-purple-400">.where(<span className="text-orange-400">"location"</span>, <span className="text-orange-400">"contains"</span>, <span className="text-orange-400">"{intent.locationFilter}"</span>)</div>
                            )}
                            {intent.sort && execution.usedIndexes && (
                              <div className="pl-4 text-green-400">.orderBy(<span className="text-orange-400">"{intent.metric}"</span>, <span className="text-orange-400">"{intent.sort}"</span>)</div>
                            )}
                            {intent.limit && (
                              <div className="pl-4 text-yellow-400">.limit(<span className="text-orange-400">{intent.limit}</span>)</div>
                            )}
                            <div className="pl-4 text-slate-400">.get()</div>
                            {intent.collections.length > 1 && (
                              <div className="mt-2 text-slate-500">// + {intent.collections.length - 1} more collection(s): {intent.collections.slice(1).join(', ')}</div>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="mb-2 flex items-center gap-2 font-semibold text-accent-light">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                            </svg>
                            Execution Path
                          </div>
                          <div className="font-mono text-[11px] text-slate-300">
                            <span className="text-cyan-400">{execution.executionPath}</span>
                          </div>
                          {execution.usedIndexes && (
                            <div className="mt-2 flex items-center gap-1.5 text-success-light">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Using composite index: (status, {intent.metric})
                            </div>
                          )}
                          {!execution.usedIndexes && (
                            <div className="mt-2 flex items-center gap-1.5 text-yellow-400">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                              </svg>
                              Client-side processing (computed metric)
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
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
            }

            // If we get here, return null (shouldn't happen with proper typing)
            return null;
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

import { openai, AI_MODEL } from './openai';
import type { Intent, CampusRecord, Metric } from './types';
import type { ExecutionResult } from './executor';
import { formatINR, formatMetricLabel, formatCollectionName, isCurrencyMetric } from './format';

/**
 * Detect which dataset type we're querying
 */
function getDatasetType(metric: Metric): 'finance' | 'sports' | 'education' {
  const sportsMetrics: Metric[] = ['medals', 'coaches', 'events', 'teams', 'sports_budget'];
  const educationMetrics: Metric[] = ['students', 'teachers', 'pass_rate', 'avg_grade', 'dropout_rate'];

  if (sportsMetrics.includes(metric)) return 'sports';
  if (educationMetrics.includes(metric)) return 'education';
  return 'finance';
}

/**
 * Generate a natural language response based on query results
 */
export async function generateNaturalResponse(
  userQuery: string,
  intent: Intent,
  execution: ExecutionResult
): Promise<string> {
  // Prepare data summary for the AI
  const dataSummary = prepareDataSummary(intent, execution);

  // Detect dataset type for context-aware prompts
  const datasetType = getDatasetType(intent.metric);

  const systemPrompt = getSystemPrompt(datasetType);

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `User Question: "${userQuery}"

Data Summary:
${dataSummary}

Generate a natural language response:`,
        },
      ],
      temperature: 0.7, // Slightly higher for natural conversation
      max_tokens: 200,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    return response.trim();
  } catch (error) {
    console.error('AI response generation failed:', error);
    // Fallback to basic response
    return generateFallbackResponse(intent, execution);
  }
}

/**
 * Prepare a summary of the data for the AI to understand
 */
function prepareDataSummary(intent: Intent, execution: ExecutionResult): string {
  const metricLabel = formatMetricLabel(intent.metric).toLowerCase();
  const records = execution.records;

  if (records.length === 0) {
    return 'No matching data found.';
  }

  let summary = '';

  // Single result with sorting/limiting
  if (intent.sort && intent.limit === 1 && records.length === 1) {
    const record = records[0];
    const value = getMetricValue(record, intent.metric);
    const formattedValue = formatValue(intent.metric, value);
    const name = record.name || record.code;
    const collection = (record as any).__collection || 'unknown';
    const collectionLabel = collection === 'sports' ? 'Sports Collection' :
                           collection === 'education' ? 'Education Collection' :
                           formatCollectionName(record.__collection);

    summary = `Result: ${name} (from ${collectionLabel}) has ${metricLabel} of ${formattedValue}.`;
  }
  // Multiple results with sorting/limiting
  else if (intent.sort && records.length > 0) {
    summary = `Top ${records.length} results by ${metricLabel}:\n`;
    records.forEach((record, index) => {
      const value = getMetricValue(record, intent.metric);
      const formattedValue = formatValue(intent.metric, value);
      const name = record.name || record.code;
      const collection = (record as any).__collection || 'unknown';
      const collectionLabel = collection === 'sports' ? 'Sports' :
                             collection === 'education' ? 'Education' :
                             formatCollectionName(record.__collection);
      summary += `${index + 1}. ${name} (${collectionLabel}): ${formattedValue}\n`;
    });
  }
  // Breakdown by collection
  else if (intent.breakdown === 'collection') {
    const breakdownByCollection: Record<string, number> = {};
    records.forEach((record) => {
      const collection = record.__collection;
      const value = getMetricValue(record, intent.metric);
      breakdownByCollection[collection] = (breakdownByCollection[collection] || 0) + value;
    });

    summary = `Breakdown by collection:\n`;
    Object.entries(breakdownByCollection).forEach(([collection, value]) => {
      const formattedValue = formatValue(intent.metric, value);
      summary += `- ${formatCollectionName(collection as any)}: ${formattedValue}\n`;
    });

    const total = Object.values(breakdownByCollection).reduce((sum, val) => sum + val, 0);
    summary += `\nTotal: ${formatValue(intent.metric, total)}`;
  }
  // Simple aggregation
  else {
    const total = records.reduce((sum, record) => sum + getMetricValue(record, intent.metric), 0);
    const formattedTotal = formatValue(intent.metric, total);
    const collections = intent.collections.map((c) => formatCollectionName(c)).join(', ');

    summary = `Total ${metricLabel} across ${collections}: ${formattedTotal} (${records.length} institutions counted)`;
  }

  return summary;
}

/**
 * Generate a fallback response when AI fails
 */
function generateFallbackResponse(intent: Intent, execution: ExecutionResult): string {
  const records = execution.records;

  if (records.length === 0) {
    return 'No matching data found for your query.';
  }

  const metricLabel = formatMetricLabel(intent.metric);

  // Single result
  if (intent.sort && intent.limit === 1 && records.length === 1) {
    const record = records[0];
    const value = getMetricValue(record, intent.metric);
    const formattedValue = formatValue(intent.metric, value);
    const name = record.name || record.code;

    const comparison = intent.sort === 'desc' ? 'highest' : 'lowest';
    return `${name} has the ${comparison} ${metricLabel.toLowerCase()} at ${formattedValue}.`;
  }

  // Multiple results
  if (intent.sort && records.length > 0) {
    return `Found ${records.length} results sorted by ${metricLabel.toLowerCase()}.`;
  }

  // Aggregation
  const total = records.reduce((sum, record) => sum + getMetricValue(record, intent.metric), 0);
  const formattedTotal = formatValue(intent.metric, total);

  return `Total ${metricLabel.toLowerCase()} is ${formattedTotal} across ${records.length} institutions.`;
}

/**
 * Get context-aware system prompt based on dataset type
 */
function getSystemPrompt(datasetType: 'finance' | 'sports' | 'education'): string {
  const baseGuidelines = `
GUIDELINES:
1. Use Indian Rupee format (₹) for currency values
2. Be conversational and friendly but professional
3. Directly answer the question in 1-2 sentences
4. Mention the institution name if available, otherwise use the code
5. For "highest/top" queries, mention the winner clearly
6. For lists, mention how many results were found
7. For breakdowns, summarize the distribution
8. Always include the actual numeric value

IMPORTANT:
- Do NOT explain what you did or how you calculated
- Do NOT say "Based on the data..." or "According to the database..."
- Just give the direct answer
- Keep it under 100 words`;

  if (datasetType === 'sports') {
    return `You are Varsity Chat, an AI assistant helping analyze sports data for educational institutions.

Your task is to provide clear, concise, natural language responses to user questions about sports data (medals, coaches, events, teams, sports budget).

RESPONSE STYLE:
- "School A has won the most medals with 45 medals."
- "The top 3 schools by number of coaches are: [list them with values]"
- "Your total sports budget across all institutions is ₹50,00,000."
- "College B has the highest number of teams with 12 teams."
${baseGuidelines}`;
  }

  if (datasetType === 'education') {
    return `You are Varsity Chat, an AI assistant helping analyze education data for educational institutions.

Your task is to provide clear, concise, natural language responses to user questions about education data (students, teachers, pass rates, grades, dropout rates).

RESPONSE STYLE:
- "School A has the most students with 1,250 students enrolled."
- "The pass rate at College B is 92%."
- "The top 3 schools by number of teachers are: [list them with values]"
- "The average grade across all institutions is 7.8 out of 10."
${baseGuidelines}`;
  }

  // Finance
  return `You are Varsity Chat, an AI assistant helping analyze financial data for educational institutions.

Your task is to provide clear, concise, natural language responses to user questions about financial data.

RESPONSE STYLE:
- "School A is your most profitable school with a profit of ₹5,10,56,000."
- "The top 5 colleges by income are: [list them with values]"
- "Your total expenditure across all institutions is ₹12,50,000."
- "The college with the lowest rent is College B, paying ₹45,000 per month."
${baseGuidelines}`;
}

/**
 * Get the metric value from a record
 */
function getMetricValue(record: CampusRecord, metric: Intent['metric']): number {
  switch (metric) {
    // Finance metrics
    case 'profit':
      return record.profit;
    case 'expenditure':
      return record.expenditure;
    case 'income':
      return record.income;
    case 'salary':
      return record.salary;
    case 'rent':
      return record.rent;
    case 'electricity':
      return record.electricity;
    case 'misc':
      return record.misc;
    case 'staff':
      return record.staff;
    // Sports metrics
    case 'medals':
      return (record as any).medals ?? 0;
    case 'coaches':
      return (record as any).coaches ?? 0;
    case 'events':
      return (record as any).events ?? 0;
    case 'teams':
      return (record as any).teams ?? 0;
    case 'sports_budget':
      return (record as any).budget ?? 0;
    // Education metrics
    case 'students':
      return (record as any).students ?? 0;
    case 'teachers':
      return (record as any).teachers ?? 0;
    case 'pass_rate':
      return (record as any).pass_rate ?? 0;
    case 'avg_grade':
      return (record as any).avg_grade ?? 0;
    case 'dropout_rate':
      return (record as any).dropout_rate ?? 0;
    default:
      return 0;
  }
}

/**
 * Format a value based on the metric type
 */
function formatValue(metric: Intent['metric'], value: number): string {
  if (isCurrencyMetric(metric)) {
    return formatINR(value);
  }

  // Format percentage metrics (pass_rate, dropout_rate are stored as 0-1)
  if (metric === 'pass_rate' || metric === 'dropout_rate') {
    return `${(value * 100).toFixed(1)}%`;
  }

  // Format avg_grade with one decimal place
  if (metric === 'avg_grade') {
    return value.toFixed(1);
  }

  return new Intl.NumberFormat('en-IN').format(value);
}

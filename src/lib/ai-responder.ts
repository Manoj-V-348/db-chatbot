import { openai, AI_MODEL } from './openai';
import type { Intent, CampusRecord } from './types';
import type { ExecutionResult } from './executor';
import { formatINR, formatMetricLabel, formatCollectionName, isCurrencyMetric } from './format';

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

  const systemPrompt = `You are a helpful financial assistant for a Campus Finance management system.

Your task is to provide clear, concise, natural language responses to user questions about financial data.

GUIDELINES:
1. Use Indian Rupee format (₹) for currency values
2. Be conversational and friendly but professional
3. Directly answer the question in 1-2 sentences
4. Mention the institution name if available, otherwise use the code
5. For "highest/top" queries, mention the winner clearly
6. For lists, mention how many results were found
7. For breakdowns, summarize the distribution
8. Always include the actual numeric value

RESPONSE STYLE:
- "School A is your most profitable school with a profit of ₹5,10,56,000."
- "The top 5 colleges by income are: [list them with values]"
- "Your total expenditure across all institutions is ₹12,50,000."
- "The college with the lowest rent is College B, paying ₹45,000 per month."

IMPORTANT:
- Do NOT explain what you did or how you calculated
- Do NOT say "Based on the data..." or "According to the database..."
- Just give the direct answer
- Keep it under 100 words`;

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
    const collection = formatCollectionName(record.__collection);

    summary = `Result: ${name} (${collection}) has ${metricLabel} of ${formattedValue}.`;
  }
  // Multiple results with sorting/limiting
  else if (intent.sort && records.length > 0) {
    summary = `Top ${records.length} results by ${metricLabel}:\n`;
    records.forEach((record, index) => {
      const value = getMetricValue(record, intent.metric);
      const formattedValue = formatValue(intent.metric, value);
      const name = record.name || record.code;
      const collection = formatCollectionName(record.__collection);
      summary += `${index + 1}. ${name} (${collection}): ${formattedValue}\n`;
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
 * Get the metric value from a record
 */
function getMetricValue(record: CampusRecord, metric: Intent['metric']): number {
  switch (metric) {
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
  return new Intl.NumberFormat('en-IN').format(value);
}

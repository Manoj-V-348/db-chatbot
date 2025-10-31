import { openai, AI_MODEL } from './openai';
import type { Intent, CollectionName, Metric, StatusFilter, SortOrder } from './types';
import { fetchCollections } from './data';

/**
 * Database schema information to send to OpenAI
 */
const DATABASE_SCHEMA = `
You are analyzing a Campus Finance database with the following structure:

COLLECTIONS:
- college1: Financial data for College 1
- school1: Financial data for School 1
- school2: Financial data for School 2

FIELDS IN EACH DOCUMENT:
- code: (string/number) Institution code
- name: (string) Institution name
- location: (string) Institution location
- status: (string) "active" or "inactive"
- type: (string) Type of institution (e.g., "college", "school")
- income: (number) Total income in rupees
- rent: (number) Rent expense in rupees
- salary: (number) Salary expense in rupees
- electricity: (number) Electricity expense in rupees
- misc: (number) Miscellaneous expense in rupees
- staff: (number) Number of staff members

COMPUTED METRICS:
- expenditure: rent + salary + electricity + misc
- profit: income - expenditure

VALID METRICS (can be queried):
- income, profit, expenditure, salary, rent, electricity, misc, staff

VALID COLLECTIONS:
- college1, school1, school2, or "all" (all three)

VALID STATUS FILTERS:
- active: Only active institutions
- inactive: Only inactive institutions
- any: All institutions regardless of status

SORTING:
- asc: Ascending (lowest to highest)
- desc: Descending (highest to lowest)

TYPE FILTERS:
- Can filter by the "type" field value (e.g., "college", "school")
`;

/**
 * Generate sample data context by fetching actual records
 */
async function getSampleDataContext(): Promise<string> {
  try {
    // Fetch 2 sample records from each collection
    const allRecords = await fetchCollections(['college1', 'school1', 'school2']);

    const samples: Record<CollectionName, any[]> = {
      college1: [],
      school1: [],
      school2: [],
    };

    // Group by collection and take first 2 from each
    allRecords.forEach((record) => {
      if (samples[record.__collection].length < 2) {
        samples[record.__collection].push({
          code: record.code,
          name: record.name || 'N/A',
          location: record.location || 'N/A',
          status: record.status,
          type: record.type || 'N/A',
          income: record.income,
          rent: record.rent,
          salary: record.salary,
          electricity: record.electricity,
          misc: record.misc,
          staff: record.staff,
          expenditure: record.expenditure,
          profit: record.profit,
        });
      }
    });

    return `
SAMPLE DATA (for context):

college1 examples:
${JSON.stringify(samples.college1, null, 2)}

school1 examples:
${JSON.stringify(samples.school1, null, 2)}

school2 examples:
${JSON.stringify(samples.school2, null, 2)}

Total records in database: ${allRecords.length}
`;
  } catch (error) {
    console.error('Failed to fetch sample data:', error);
    return 'Sample data unavailable.';
  }
}

/**
 * Use OpenAI to parse user query into structured Intent
 */
export async function parseWithAI(userQuery: string): Promise<Intent> {
  const sampleData = await getSampleDataContext();

  const systemPrompt = `${DATABASE_SCHEMA}

${sampleData}

Your task is to convert user questions into a structured JSON query object.

OUTPUT FORMAT (JSON only, no explanation):
{
  "metric": "income" | "profit" | "expenditure" | "salary" | "rent" | "electricity" | "misc" | "staff",
  "collections": ["college1"] | ["school1"] | ["school2"] | ["college1", "school1", "school2"],
  "status": "active" | "inactive" | "any",
  "breakdown": "none" | "collection",
  "typeFilter": string | undefined,
  "sort": "asc" | "desc" | undefined,
  "limit": number | undefined
}

RULES:
1. Default status is "active" unless user specifies "all", "any status", or "inactive"
2. If user asks for "all collections" or doesn't specify, use all three: ["college1", "school1", "school2"]
3. If user asks for "colleges", use ["college1"]
4. If user asks for "schools", use ["school1", "school2"]
5. "breakdown" should be "collection" only if user explicitly asks for breakdown or "by collection"
6. Set "sort" to "desc" for queries with "highest", "top", "most", "maximum"
7. Set "sort" to "asc" for queries with "lowest", "bottom", "least", "minimum"
8. Set "limit" if user specifies a number like "top 5", "first 10"
9. Set "typeFilter" if user mentions a specific type like "colleges only" or "schools only"
10. For profit queries, use metric "profit"
11. For total cost/expense queries, use metric "expenditure"

EXAMPLES:

User: "Which is my highest profitable school?"
Output: {"metric":"profit","collections":["school1","school2"],"status":"active","breakdown":"none","sort":"desc","limit":1}

User: "Show me top 5 colleges by income"
Output: {"metric":"income","collections":["college1"],"status":"active","breakdown":"none","sort":"desc","limit":5}

User: "What is the total expenditure across all institutions?"
Output: {"metric":"expenditure","collections":["college1","school1","school2"],"status":"active","breakdown":"none"}

User: "Show active schools with lowest rent"
Output: {"metric":"rent","collections":["school1","school2"],"status":"active","breakdown":"none","sort":"asc"}

User: "Total profit breakdown by collection"
Output: {"metric":"profit","collections":["college1","school1","school2"],"status":"active","breakdown":"collection"}

Now convert this user query:`;

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
      ],
      temperature: 0.1, // Low temperature for consistent, accurate parsing
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    const intent = JSON.parse(responseText) as Intent;

    // Validate the parsed intent
    validateIntent(intent);

    return intent;
  } catch (error) {
    console.error('AI parsing failed:', error);
    throw new Error('Failed to parse query with AI. Please try rephrasing your question.');
  }
}

/**
 * Validate that the Intent object has valid values
 */
function validateIntent(intent: Intent): void {
  const validMetrics: Metric[] = ['income', 'profit', 'expenditure', 'salary', 'rent', 'electricity', 'misc', 'staff'];
  const validCollections: CollectionName[] = ['college1', 'school1', 'school2'];
  const validStatus: StatusFilter[] = ['active', 'inactive', 'any'];
  const validBreakdown = ['none', 'collection'];
  const validSort: (SortOrder | undefined)[] = ['asc', 'desc', undefined];

  if (!validMetrics.includes(intent.metric)) {
    throw new Error(`Invalid metric: ${intent.metric}`);
  }

  if (!intent.collections.every((c) => validCollections.includes(c))) {
    throw new Error(`Invalid collections: ${intent.collections.join(', ')}`);
  }

  if (!validStatus.includes(intent.status)) {
    throw new Error(`Invalid status: ${intent.status}`);
  }

  if (!validBreakdown.includes(intent.breakdown)) {
    throw new Error(`Invalid breakdown: ${intent.breakdown}`);
  }

  if (!validSort.includes(intent.sort)) {
    throw new Error(`Invalid sort: ${intent.sort}`);
  }

  if (intent.limit !== undefined && (intent.limit < 1 || intent.limit > 100)) {
    throw new Error(`Invalid limit: ${intent.limit}. Must be between 1 and 100.`);
  }
}

import { openai, AI_MODEL } from './openai';
import type { Intent, CollectionName, Metric, StatusFilter, SortOrder } from './types';
import { fetchCollections } from './data';
import type { CrossCollectionIntent } from './cross-collection';

/**
 * Database schema information to send to OpenAI
 */
const DATABASE_SCHEMA = `
You are analyzing a Campus database with the following structure:

FINANCE COLLECTIONS:
- college1: Financial data for College 1
- school1: Financial data for School 1
- school2: Financial data for School 2

FINANCE FIELDS:
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

COMPUTED FINANCE METRICS:
- expenditure: rent + salary + electricity + misc
- profit: income - expenditure

SPORTS COLLECTION (sports):
- code: (number) Institution code
- name: (string) Institution name
- location: (string) Institution location
- status: (string) "active" or "inactive"
- type: (string) "school" or "college"
- teams: (number) Number of sports teams
- coaches: (number) Number of coaches
- playgrounds: (number) Number of playgrounds
- events: (number) Number of events held
- medals: (number) Number of medals won
- budget: (number) Sports budget in rupees

EDUCATION COLLECTION (education):
- code: (number) Institution code
- name: (string) Institution name
- location: (string) Institution location
- status: (string) "active" or "inactive"
- type: (string) "school" or "college"
- students: (number) Number of students
- teachers: (number) Number of teachers
- pass_rate: (number) Pass rate (0-1, e.g., 0.92 = 92%)
- avg_grade: (number) Average grade (0-10)
- dropout_rate: (number) Dropout rate (0-1, e.g., 0.012 = 1.2%)
- labs: (number) Number of labs
- library_books: (number) Number of library books
- programs: (number) Number of programs offered

VALID METRICS (can be queried):
FINANCE: income, profit, expenditure, salary, rent, electricity, misc, staff
SPORTS: medals, coaches, events, teams, sports_budget
EDUCATION: students, teachers, pass_rate, avg_grade, dropout_rate

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

LOCATION QUERIES:
- Users can filter by location (e.g., "TS Hyderabad East Maredpally")
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
  "locationFilter": string | undefined,
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
10. Set "locationFilter" if user mentions a specific location like "East Maredpally", "TS Hyderabad", "Maredpally"
11. For profit queries, use metric "profit"
12. For total cost/expense queries, use metric "expenditure"

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

User: "What is the pass rate for TS Hyderabad East Maredpally?"
Output: {"metric":"pass_rate","collections":["college1","school1","school2"],"status":"active","breakdown":"none","locationFilter":"TS Hyderabad East Maredpally"}

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
  const validMetrics: Metric[] = [
    'income', 'profit', 'expenditure', 'salary', 'rent', 'electricity', 'misc', 'staff',
    'medals', 'coaches', 'events', 'teams', 'sports_budget',
    'students', 'teachers', 'pass_rate', 'avg_grade', 'dropout_rate'
  ];
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

/**
 * Detect if a query requires cross-collection data (multiple metrics from different datasets)
 */
export function isCrossCollectionQuery(userQuery: string): boolean {
  const query = userQuery.toLowerCase();

  // Check for explicit comparison keywords
  const comparisonKeywords = ['compare', 'versus', 'vs', 'and also show', 'along with'];
  if (comparisonKeywords.some((keyword) => query.includes(keyword))) {
    return true;
  }

  // Check if multiple different dataset metrics are mentioned
  const sportsKeywords = ['medal', 'coach', 'event', 'team', 'sports budget'];
  const educationKeywords = ['student', 'teacher', 'pass rate', 'grade', 'dropout'];
  const financeKeywords = ['income', 'profit', 'expenditure', 'salary', 'rent', 'electricity'];

  const mentionsSports = sportsKeywords.some((keyword) => query.includes(keyword));
  const mentionsEducation = educationKeywords.some((keyword) => query.includes(keyword));
  const mentionsFinance = financeKeywords.some((keyword) => query.includes(keyword));

  // If mentions metrics from 2+ different datasets, it's a cross-collection query
  const datasetCount = [mentionsSports, mentionsEducation, mentionsFinance].filter(Boolean).length;
  return datasetCount >= 2;
}

/**
 * Parse a cross-collection query using AI
 */
export async function parseCrossCollectionQuery(userQuery: string): Promise<CrossCollectionIntent> {
  const systemPrompt = `${DATABASE_SCHEMA}

You are analyzing a query that requires data from MULTIPLE collections/datasets.

Your task is to identify ALL metrics the user wants to compare or view together.

OUTPUT FORMAT (JSON only):
{
  "metrics": ["medal", "pass_rate"],
  "locationFilter": string | undefined,
  "status": "active" | "inactive" | "any",
  "typeFilter": string | undefined
}

RULES:
1. List ALL metrics mentioned in the query (can be from different datasets)
2. Extract location filter if user mentions a specific location like "East Maredpally"
3. Default status is "active" unless specified otherwise
4. Set typeFilter if user specifies "schools only" or "colleges only"

EXAMPLES:

User: "compare medals and pass rate across all schools"
Output: {"metrics":["medals","pass_rate"],"status":"active","typeFilter":"school"}

User: "show me income and number of students for East Maredpally"
Output: {"metrics":["income","students"],"locationFilter":"East Maredpally","status":"active"}

User: "what are the medals, pass rate, and profit for all locations?"
Output: {"metrics":["medals","pass_rate","profit"],"status":"active"}

Now parse this query:`;

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(responseText);

    // Validate and return
    return {
      metrics: parsed.metrics || [],
      locationFilter: parsed.locationFilter,
      status: parsed.status || 'active',
      typeFilter: parsed.typeFilter,
    };
  } catch (error) {
    console.error('Cross-collection parsing failed:', error);
    throw new Error('Failed to parse cross-collection query. Please try rephrasing your question.');
  }
}

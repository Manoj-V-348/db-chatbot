import type { CampusRecord, Intent, Metric } from './types';
import {
  fetchCollections,
  readByStatusSorted,
  readByTypeSorted,
  readByStatusTypeSorted,
  readSports,
  readEducation,
} from './data';
import { expenditureOf, profitOf } from './format';

export interface ExecutionResult {
  records: CampusRecord[];
  docsRead: number;
  usedIndexes: boolean;
  executionPath: string;
}

/**
 * Determines which dataset type to use based on the metric
 */
function getDatasetType(metric: Metric): 'finance' | 'sports' | 'education' {
  const sportsMetrics: Metric[] = ['medals', 'coaches', 'events', 'teams', 'sports_budget'];
  const educationMetrics: Metric[] = ['students', 'teachers', 'pass_rate', 'avg_grade', 'dropout_rate'];

  if (sportsMetrics.includes(metric)) return 'sports';
  if (educationMetrics.includes(metric)) return 'education';
  return 'finance';
}

/**
 * Determines if we can use Firestore indexes for this query.
 * Indexes are available for: income, rent, salary, electricity, misc
 * NOT available for: profit, expenditure, staff (computed or not indexed)
 */
function canUseIndexes(intent: Intent): boolean {
  const indexedMetrics: Metric[] = ['income', 'rent', 'salary', 'electricity', 'misc'];
  return indexedMetrics.includes(intent.metric) && intent.sort !== undefined;
}

/**
 * Execute intent using Firestore indexes when possible.
 * Falls back to client-side filtering and sorting when indexes aren't available.
 */
export async function execute(intent: Intent): Promise<ExecutionResult> {
  const { collections, status, typeFilter, sort, limit, metric } = intent;

  // Route to sports or education executor if metric matches those datasets
  const datasetType = getDatasetType(metric);
  if (datasetType === 'sports') {
    return executeSportsQuery(intent);
  }
  if (datasetType === 'education') {
    return executeEducationQuery(intent);
  }

  // Path 1: Use Firestore indexes for sorting (optimal performance)
  if (canUseIndexes(intent)) {
    const indexedMetric = metric as 'income' | 'rent' | 'salary' | 'electricity' | 'misc';
    const sortOrder = sort!; // We know sort is defined because canUseIndexes checks it
    let allRecords: CampusRecord[] = [];

    for (const collectionName of collections) {
      let records: CampusRecord[] = [];

      // Use appropriate Firestore query based on filters
      if (status !== 'any' && typeFilter) {
        // Both status and type filter
        records = await readByStatusTypeSorted(
          collectionName,
          status as 'active' | 'inactive',
          typeFilter,
          indexedMetric,
          sortOrder,
          limit
        );
      } else if (status !== 'any') {
        // Only status filter
        records = await readByStatusSorted(
          collectionName,
          status as 'active' | 'inactive',
          indexedMetric,
          sortOrder,
          limit
        );
      } else if (typeFilter) {
        // Only type filter
        records = await readByTypeSorted(
          collectionName,
          typeFilter,
          indexedMetric,
          sortOrder,
          limit
        );
      } else {
        // No filters, just sorting - fetch all and sort client-side
        const allDocs = await fetchCollections([collectionName]);
        records = sortRecordsClientSide(allDocs, metric, sortOrder);
        if (limit) {
          records = records.slice(0, limit);
        }
      }

      allRecords = allRecords.concat(records);
    }

    // If querying multiple collections, we need to re-sort and limit across all results
    if (collections.length > 1 && sort) {
      allRecords = sortRecordsClientSide(allRecords, metric, sortOrder);
      if (limit) {
        allRecords = allRecords.slice(0, limit);
      }
    }

    return {
      records: allRecords,
      docsRead: allRecords.length,
      usedIndexes: true,
      executionPath: 'firestore-indexes',
    };
  }

  // Path 2: Client-side filtering and sorting (for computed metrics or no sort)
  let records = await fetchCollections(collections);
  const docsRead = records.length;

  // Apply status filter
  if (status !== 'any') {
    records = records.filter((record) => record.status === status);
  }

  // Apply type filter
  if (typeFilter) {
    records = records.filter(
      (record) => record.type?.toLowerCase() === typeFilter.toLowerCase()
    );
  }

  // Apply location filter
  if (intent.locationFilter) {
    const locationLower = intent.locationFilter.toLowerCase();
    records = records.filter((record) =>
      record.location?.toLowerCase().includes(locationLower)
    );
  }

  // Apply sorting if requested
  if (sort) {
    records = sortRecordsClientSide(records, metric, sort);
  }

  // Apply limit
  if (limit) {
    records = records.slice(0, limit);
  }

  return {
    records,
    docsRead,
    usedIndexes: false,
    executionPath: 'client-side',
  };
}

/**
 * Execute sports queries
 */
async function executeSportsQuery(intent: Intent): Promise<ExecutionResult> {
  const { status, typeFilter, sort, limit, metric, locationFilter } = intent;

  // Map sports_budget to budget field
  const fieldName = metric === 'sports_budget' ? 'budget' : metric;

  let records = await readSports({
    status: status === 'any' ? undefined : (status as 'active' | 'inactive'),
    type: typeFilter as 'school' | 'college' | undefined,
    orderField: sort ? fieldName : undefined,
    orderDir: sort,
    limit,
  });

  // Apply location filter if specified (client-side since Firestore doesn't support it)
  if (locationFilter) {
    const locationLower = locationFilter.toLowerCase();
    records = records.filter((record) =>
      record.location?.toLowerCase().includes(locationLower)
    );
  }

  // Convert SportsRecord[] to CampusRecord[] for compatibility
  const campusRecords: any[] = records.map((r) => ({
    id: String(r.code),
    __collection: 'sports',
    __datasetType: 'sports',
    code: String(r.code),
    name: r.name,
    location: r.location,
    status: r.status === 'active' ? 'active' : r.status === 'inactive' ? 'inactive' : 'unknown',
    type: r.type,
    rent: 0,
    salary: 0,
    electricity: 0,
    misc: 0,
    income: 0,
    staff: 0,
    expenditure: 0,
    profit: 0,
    // Sports-specific fields
    teams: r.teams,
    coaches: r.coaches,
    playgrounds: r.playgrounds,
    events: r.events,
    medals: r.medals,
    budget: r.budget,
  }));

  return {
    records: campusRecords,
    docsRead: records.length,
    usedIndexes: sort !== undefined,
    executionPath: 'sports-collection',
  };
}

/**
 * Execute education queries
 */
async function executeEducationQuery(intent: Intent): Promise<ExecutionResult> {
  const { status, typeFilter, sort, limit, metric, locationFilter } = intent;

  let records = await readEducation({
    status: status === 'any' ? undefined : (status as 'active' | 'inactive'),
    type: typeFilter as 'school' | 'college' | undefined,
    orderField: sort ? metric : undefined,
    orderDir: sort,
    limit,
  });

  // Apply location filter if specified (client-side since Firestore doesn't support it)
  if (locationFilter) {
    const locationLower = locationFilter.toLowerCase();
    records = records.filter((record) =>
      record.location?.toLowerCase().includes(locationLower)
    );
  }

  // Convert EducationRecord[] to CampusRecord[] for compatibility
  const campusRecords: any[] = records.map((r) => ({
    id: String(r.code),
    __collection: 'education',
    __datasetType: 'education',
    code: String(r.code),
    name: r.name,
    location: r.location,
    status: r.status === 'active' ? 'active' : r.status === 'inactive' ? 'inactive' : 'unknown',
    type: r.type,
    rent: 0,
    salary: 0,
    electricity: 0,
    misc: 0,
    income: 0,
    staff: 0,
    expenditure: 0,
    profit: 0,
    // Education-specific fields
    students: r.students,
    teachers: r.teachers,
    pass_rate: r.pass_rate,
    avg_grade: r.avg_grade,
    dropout_rate: r.dropout_rate,
    labs: r.labs,
    library_books: r.library_books,
    programs: r.programs,
  }));

  return {
    records: campusRecords,
    docsRead: records.length,
    usedIndexes: sort !== undefined,
    executionPath: 'education-collection',
  };
}

/**
 * Sort records client-side by a given metric.
 * Handles computed metrics like profit and expenditure.
 */
function sortRecordsClientSide(
  records: CampusRecord[],
  metric: Metric,
  order: 'asc' | 'desc'
): CampusRecord[] {
  const getValue = (record: CampusRecord): number => {
    switch (metric) {
      case 'profit':
        return profitOf(record);
      case 'expenditure':
        return expenditureOf(record);
      case 'income':
        return record.income;
      case 'rent':
        return record.rent;
      case 'salary':
        return record.salary;
      case 'electricity':
        return record.electricity;
      case 'misc':
        return record.misc;
      case 'staff':
        return record.staff;
      default:
        return 0;
    }
  };

  const sorted = [...records].sort((a, b) => {
    const aValue = getValue(a);
    const bValue = getValue(b);
    return order === 'desc' ? bValue - aValue : aValue - bValue;
  });

  return sorted;
}

/**
 * Format a natural language description of the query execution.
 */
export function describeExecution(intent: Intent, result: ExecutionResult): string {
  const parts: string[] = [];

  // Describe what was fetched
  if (result.usedIndexes) {
    parts.push('Used Firestore indexes for optimal performance.');
  } else {
    parts.push('Processed data client-side.');
  }

  // Describe filters
  if (intent.status !== 'any') {
    parts.push(`Filtered to ${intent.status} records.`);
  }

  if (intent.typeFilter) {
    parts.push(`Filtered to type: ${intent.typeFilter}.`);
  }

  // Describe sorting
  if (intent.sort) {
    const direction = intent.sort === 'desc' ? 'highest to lowest' : 'lowest to highest';
    parts.push(`Sorted by ${intent.metric} (${direction}).`);
  }

  // Describe limit
  if (intent.limit) {
    parts.push(`Limited to top ${intent.limit} results.`);
  }

  parts.push(`Read ${result.docsRead} documents, returned ${result.records.length} records.`);

  return parts.join(' ');
}

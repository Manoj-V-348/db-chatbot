import type { Metric } from './types';
import { readSports, readEducation, fetchCollections } from './data';
import type { ExecutionResult } from './executor';

/**
 * Interface for cross-collection queries
 */
export interface CrossCollectionIntent {
  metrics: Metric[];
  locationFilter?: string;
  status?: 'active' | 'inactive' | 'any';
  typeFilter?: string;
}

/**
 * Merged record with data from multiple collections
 */
interface MergedRecord {
  code: string;
  name: string;
  location: string;
  status: 'active' | 'inactive' | 'unknown';
  type: string;
  [key: string]: any; // Allow additional fields from different collections
}

/**
 * Determine which dataset a metric belongs to
 */
function getMetricDataset(metric: Metric): 'finance' | 'sports' | 'education' {
  const sportsMetrics: Metric[] = ['medals', 'coaches', 'events', 'teams', 'sports_budget'];
  const educationMetrics: Metric[] = ['students', 'teachers', 'pass_rate', 'avg_grade', 'dropout_rate'];

  if (sportsMetrics.includes(metric)) return 'sports';
  if (educationMetrics.includes(metric)) return 'education';
  return 'finance';
}

/**
 * Execute a cross-collection query that combines data from multiple datasets
 */
export async function executeCrossCollectionQuery(
  intent: CrossCollectionIntent
): Promise<ExecutionResult> {
  const datasetsNeeded = new Set(intent.metrics.map(getMetricDataset));

  // Fetch data from all needed collections
  const promises: Promise<any[]>[] = [];
  const datasetTypes: Array<'finance' | 'sports' | 'education'> = [];

  if (datasetsNeeded.has('finance')) {
    promises.push(fetchCollections(['college1', 'school1', 'school2']));
    datasetTypes.push('finance');
  }

  if (datasetsNeeded.has('sports')) {
    promises.push(
      readSports({
        status: intent.status === 'any' ? undefined : intent.status,
        type: intent.typeFilter as 'school' | 'college' | undefined,
      })
    );
    datasetTypes.push('sports');
  }

  if (datasetsNeeded.has('education')) {
    promises.push(
      readEducation({
        status: intent.status === 'any' ? undefined : intent.status,
        type: intent.typeFilter as 'school' | 'college' | undefined,
      })
    );
    datasetTypes.push('education');
  }

  const results = await Promise.all(promises);

  // Merge records by location
  const mergedByLocation = new Map<string, MergedRecord>();

  results.forEach((records, index) => {
    const datasetType = datasetTypes[index];

    records.forEach((record: any) => {
      const location = record.location;
      if (!location) return;

      if (!mergedByLocation.has(location)) {
        mergedByLocation.set(location, {
          code: String(record.code),
          name: record.name,
          location: record.location,
          status: record.status || 'unknown',
          type: record.type || 'unknown',
          __collection: 'merged',
          __datasetType: 'merged',
        });
      }

      const merged = mergedByLocation.get(location)!;

      // Add dataset-specific fields
      if (datasetType === 'finance') {
        merged.income = record.income;
        merged.rent = record.rent;
        merged.salary = record.salary;
        merged.electricity = record.electricity;
        merged.misc = record.misc;
        merged.staff = record.staff;
        merged.expenditure = record.expenditure;
        merged.profit = record.profit;
      } else if (datasetType === 'sports') {
        merged.medals = record.medals;
        merged.coaches = record.coaches;
        merged.events = record.events;
        merged.teams = record.teams;
        merged.sports_budget = record.budget;
      } else if (datasetType === 'education') {
        merged.students = record.students;
        merged.teachers = record.teachers;
        merged.pass_rate = record.pass_rate;
        merged.avg_grade = record.avg_grade;
        merged.dropout_rate = record.dropout_rate;
      }
    });
  });

  // Apply location filter if specified
  let finalRecords = Array.from(mergedByLocation.values());

  if (intent.locationFilter) {
    const locationLower = intent.locationFilter.toLowerCase();
    finalRecords = finalRecords.filter((record) =>
      record.location.toLowerCase().includes(locationLower)
    );
  }

  // Apply status filter if specified
  if (intent.status && intent.status !== 'any') {
    finalRecords = finalRecords.filter((record) => record.status === intent.status);
  }

  // Apply type filter if specified
  if (intent.typeFilter) {
    finalRecords = finalRecords.filter(
      (record) => record.type?.toLowerCase() === intent.typeFilter?.toLowerCase()
    );
  }

  return {
    records: finalRecords as any[],
    docsRead: results.reduce((sum, r) => sum + r.length, 0),
    usedIndexes: false,
    executionPath: 'cross-collection-merge',
  };
}

/**
 * Generate a natural language response for cross-collection queries
 */
export function generateCrossCollectionResponse(
  _userQuery: string,
  intent: CrossCollectionIntent,
  result: ExecutionResult
): string {
  const records = result.records;

  if (records.length === 0) {
    return 'No matching data found across the collections.';
  }

  // Build a summary for each location
  const summaries: string[] = [];

  records.forEach((record: any) => {
    const parts: string[] = [];
    parts.push(`**${record.name}** (${record.location}):`);

    intent.metrics.forEach((metric) => {
      const value = record[metric === 'sports_budget' ? 'budget' : metric];
      if (value !== undefined && value !== null) {
        const formattedValue = formatMetricValue(metric, value);
        parts.push(`  - ${formatMetricName(metric)}: ${formattedValue}`);
      }
    });

    summaries.push(parts.join('\n'));
  });

  return summaries.join('\n\n');
}

/**
 * Format a metric value for display
 */
function formatMetricValue(metric: Metric, value: number): string {
  if (metric === 'pass_rate' || metric === 'dropout_rate') {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (metric === 'avg_grade') {
    return value.toFixed(1);
  }
  if (
    metric === 'income' ||
    metric === 'profit' ||
    metric === 'expenditure' ||
    metric === 'salary' ||
    metric === 'rent' ||
    metric === 'electricity' ||
    metric === 'misc' ||
    metric === 'sports_budget'
  ) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat('en-IN').format(value);
}

/**
 * Format a metric name for display
 */
function formatMetricName(metric: Metric): string {
  const names: Record<Metric, string> = {
    income: 'Income',
    profit: 'Profit',
    expenditure: 'Expenditure',
    salary: 'Salary',
    rent: 'Rent',
    electricity: 'Electricity',
    misc: 'Miscellaneous',
    staff: 'Staff',
    medals: 'Medals',
    coaches: 'Coaches',
    events: 'Events',
    teams: 'Teams',
    sports_budget: 'Sports Budget',
    students: 'Students',
    teachers: 'Teachers',
    pass_rate: 'Pass Rate',
    avg_grade: 'Average Grade',
    dropout_rate: 'Dropout Rate',
  };
  return names[metric] || metric;
}

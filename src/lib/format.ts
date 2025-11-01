import type { CollectionName, Metric } from './types';

const currencyMetrics: Metric[] = [
  'income',
  'profit',
  'expenditure',
  'salary',
  'rent',
  'electricity',
  'misc',
  'sports_budget',
];

const METRIC_LABELS: Record<Metric, string> = {
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

const COLLECTION_LABELS: Record<CollectionName, string> = {
  college1: 'College 1',
  school1: 'School 1',
  school2: 'School 2',
};

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]+/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function formatINR(value: number): string {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    return '₹0';
  }

  return inrFormatter.format(value);
}

export function formatMetricLabel(metric: Metric): string {
  return METRIC_LABELS[metric];
}

export function isCurrencyMetric(metric: Metric): boolean {
  return currencyMetrics.includes(metric);
}

export function formatCollectionName(collection: CollectionName): string {
  return COLLECTION_LABELS[collection];
}

export function formatCollectionList(collections: CollectionName[]): string {
  return collections.map((name) => COLLECTION_LABELS[name]).join(' + ');
}

export function formatStatusLabel(status: 'active' | 'inactive' | 'unknown'): string {
  if (status === 'unknown') {
    return 'Unknown';
  }
  return status === 'active' ? 'Active' : 'Inactive';
}

export function expenditureOf(record: { rent: number; salary: number; electricity: number; misc: number }): number {
  return record.rent + record.salary + record.electricity + record.misc;
}

export function profitOf(record: { income: number; rent: number; salary: number; electricity: number; misc: number }): number {
  const expenditure = expenditureOf(record);
  return record.income - expenditure;
}

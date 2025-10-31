export const COLLECTIONS = ['college1', 'school1', 'school2'] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

export type Metric =
  | 'income'
  | 'profit'
  | 'expenditure'
  | 'salary'
  | 'rent'
  | 'electricity'
  | 'misc'
  | 'staff';

export type BreakdownMode = 'none' | 'collection';

export type StatusFilter = 'active' | 'inactive' | 'any';

export type SortOrder = 'asc' | 'desc';

export interface Intent {
  metric: Metric;
  collections: CollectionName[];
  status: StatusFilter;
  breakdown: BreakdownMode;
  typeFilter?: string; // e.g., "college", "school", etc.
  sort?: SortOrder; // Sort by metric value
  limit?: number; // Limit number of results
}

export interface CampusRecord {
  id: string;
  __collection: CollectionName;
  code: string; // Now required - will use document ID as fallback
  name?: string;
  location?: string;
  statusRaw?: string;
  status: 'active' | 'inactive' | 'unknown';
  type?: string;
  rent: number;
  salary: number;
  electricity: number;
  misc: number;
  income: number;
  staff: number;
  expenditure: number;
  profit: number;
}

export interface AggregateBreakdown {
  collection: CollectionName;
  value: number;
}

export interface AggregateResult {
  total: number;
  breakdown: AggregateBreakdown[];
  docsRead: number;
  filteredCount: number;
  statusApplied: StatusFilter;
}


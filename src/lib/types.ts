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
  | 'staff'
  | 'medals'
  | 'coaches'
  | 'events'
  | 'teams'
  | 'sports_budget'
  | 'students'
  | 'teachers'
  | 'pass_rate'
  | 'avg_grade'
  | 'dropout_rate';

export type BreakdownMode = 'none' | 'collection';

export type StatusFilter = 'active' | 'inactive' | 'any';

export type SortOrder = 'asc' | 'desc';

export interface Intent {
  metric: Metric;
  collections: CollectionName[];
  status: StatusFilter;
  breakdown: BreakdownMode;
  typeFilter?: string; // e.g., "college", "school", etc.
  locationFilter?: string; // e.g., "East Maredpally", "Hyderabad"
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

// New types for sports and education collections
export type Status = "active" | "inactive";
export type CampusType = "school" | "college";

export interface SportsRecord {
  code: number;
  location: string;
  name: string;
  type: CampusType;
  status: Status;
  teams?: number;
  coaches?: number;
  playgrounds?: number;
  events?: number;
  medals?: number;
  budget?: number;
  __collection?: "sports";
}

export interface EducationRecord {
  code: number;
  location: string;
  name: string;
  type: CampusType;
  status: Status;
  students?: number;
  teachers?: number;
  pass_rate?: number;
  avg_grade?: number;
  dropout_rate?: number;
  labs?: number;
  library_books?: number;
  programs?: number;
  __collection?: "education";
}


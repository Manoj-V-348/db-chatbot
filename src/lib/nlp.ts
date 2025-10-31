import { COLLECTIONS } from './types';
import type { CollectionName, Intent, Metric, StatusFilter, SortOrder } from './types';

const metricMatchers: Array<{ metric: Metric; patterns: RegExp[] }> = [
  {
    metric: 'profit',
    patterns: [/\boverall surplus\b/, /\bsurplus\b/, /\bprofit\b/],
  },
  {
    metric: 'expenditure',
    patterns: [/\bexpenditure\b/, /\bexpenses?\b/, /\bspend(ing)?\b/, /\bcosts?\b/],
  },
  {
    metric: 'electricity',
    patterns: [/\belectric(ity)?\b/, /\bpower bill\b/],
  },
  {
    metric: 'salary',
    patterns: [/\bsalar(y|ies)\b/, /\bwages\b/, /\bpayroll\b/],
  },
  {
    metric: 'rent',
    patterns: [/\brent(al)?\b/],
  },
  {
    metric: 'misc',
    patterns: [/\bmisc(ellaneous)?\b/],
  },
  {
    metric: 'staff',
    patterns: [/\bstaff\b/, /\bheadcount\b/],
  },
  {
    metric: 'income',
    patterns: [/\bincome\b/, /\brevenue\b/],
  },
];

const collectionMatchers: Record<CollectionName, RegExp[]> = {
  college1: [/\bcollege1\b/, /\bcollege\b/],
  school1: [/\bschool1\b/],
  school2: [/\bschool2\b/],
};

const ALL_SET = new Set<CollectionName>(COLLECTIONS);

function detectMetric(normalized: string): Metric {
  for (const matcher of metricMatchers) {
    if (matcher.patterns.some((pattern) => pattern.test(normalized))) {
      return matcher.metric;
    }
  }

  return 'income';
}

function detectCollections(normalized: string): CollectionName[] {
  if (/\ball\b/.test(normalized)) {
    return [...ALL_SET];
  }

  const detected = new Set<CollectionName>();

  (Object.keys(collectionMatchers) as CollectionName[]).forEach((collection) => {
    const patterns = collectionMatchers[collection];
    if (patterns.some((pattern) => pattern.test(normalized))) {
      detected.add(collection);
    }
  });

  if (detected.size === 0) {
    return [...ALL_SET];
  }

  return Array.from(detected);
}

function detectStatus(normalized: string): StatusFilter {
  if (/\bany status\b/.test(normalized) || /\ball status(es)?\b/.test(normalized)) {
    return 'any';
  }

  if (/\binactive( only)?\b/.test(normalized)) {
    return 'inactive';
  }

  if (/\bactive( only)?\b/.test(normalized)) {
    return 'active';
  }

  return 'active';
}

function detectBreakdown(normalized: string): Intent['breakdown'] {
  if (/\bbreakdown\b/.test(normalized) || /\bby collection\b/.test(normalized)) {
    return 'collection';
  }

  return 'none';
}

function detectTypeFilter(normalized: string): string | undefined {
  // Match patterns like "type: college", "type college", "colleges only", etc.
  const typeMatch = normalized.match(/\btype[:\s]+(\w+)\b/);
  if (typeMatch) {
    return typeMatch[1];
  }

  // Match "colleges only", "schools only"
  if (/\bcolleges?\s+only\b/.test(normalized)) {
    return 'college';
  }
  if (/\bschools?\s+only\b/.test(normalized)) {
    return 'school';
  }

  return undefined;
}

function detectSort(normalized: string): SortOrder | undefined {
  // Check for sorting keywords
  if (/\b(highest|top|most|descending|desc)\b/.test(normalized)) {
    return 'desc';
  }
  if (/\b(lowest|bottom|least|ascending|asc)\b/.test(normalized)) {
    return 'asc';
  }

  // Default to desc for common patterns like "top 5"
  if (/\btop\s+\d+\b/.test(normalized)) {
    return 'desc';
  }

  return undefined;
}

function detectLimit(normalized: string): number | undefined {
  // Match patterns like "top 5", "first 10", "limit 3"
  const topMatch = normalized.match(/\btop\s+(\d+)\b/);
  if (topMatch) {
    return Number.parseInt(topMatch[1], 10);
  }

  const firstMatch = normalized.match(/\bfirst\s+(\d+)\b/);
  if (firstMatch) {
    return Number.parseInt(firstMatch[1], 10);
  }

  const limitMatch = normalized.match(/\blimit\s+(\d+)\b/);
  if (limitMatch) {
    return Number.parseInt(limitMatch[1], 10);
  }

  return undefined;
}

export function parse(input: string): Intent {
  const normalized = input.toLowerCase();
  const metric = detectMetric(normalized);
  const collections = detectCollections(normalized);
  const status = detectStatus(normalized);
  const breakdown = detectBreakdown(normalized);
  const typeFilter = detectTypeFilter(normalized);
  const sort = detectSort(normalized);
  const limit = detectLimit(normalized);

  return {
    metric,
    collections,
    status,
    breakdown,
    typeFilter,
    sort,
    limit,
  };
}

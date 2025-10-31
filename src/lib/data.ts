import { collection, getDocs, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AggregateResult,
  CampusRecord,
  CollectionName,
  Intent,
  Metric,
  StatusFilter,
} from './types';
import { toNumber, expenditureOf, profitOf } from './format';

const metricExtractor: Record<Metric, (record: CampusRecord) => number> = {
  income: (record) => record.income,
  profit: (record) => record.profit,
  expenditure: (record) => record.expenditure,
  salary: (record) => record.salary,
  rent: (record) => record.rent,
  electricity: (record) => record.electricity,
  misc: (record) => record.misc,
  staff: (record) => record.staff,
};

function normalizeStatus(value: unknown): 'active' | 'inactive' | 'unknown' {
  if (typeof value !== 'string') {
    return 'unknown';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.includes('inactive')) {
    return 'inactive';
  }

  if (normalized.includes('active')) {
    return 'active';
  }

  return 'unknown';
}

function mapDocument(doc: Record<string, unknown>, id: string, collectionName: CollectionName): CampusRecord {
  const rent = toNumber(doc.rent);
  const salary = toNumber(doc.salary);
  const electricity = toNumber(doc.electricity);
  const misc = toNumber(doc.misc);
  const income = toNumber(doc.income);
  const staff = toNumber(doc.staff);

  // Use doc.code if available (string or number), otherwise use document ID as fallback
  const code = doc.code !== undefined && doc.code !== null && doc.code !== ''
    ? String(doc.code)
    : id;

  const record = {
    id,
    __collection: collectionName,
    code,
    name: typeof doc.name === 'string' ? doc.name : undefined,
    location: typeof doc.location === 'string' ? doc.location : undefined,
    type: typeof doc.type === 'string' ? doc.type : undefined,
    statusRaw: typeof doc.status === 'string' ? doc.status : undefined,
    status: normalizeStatus(doc.status),
    rent,
    salary,
    electricity,
    misc,
    income,
    staff,
    expenditure: 0, // Will be computed below
    profit: 0, // Will be computed below
  };

  // Compute derived values using helper functions
  record.expenditure = expenditureOf(record);
  record.profit = profitOf(record);

  return record;
}

export async function fetchCollections(collections: CollectionName[]): Promise<CampusRecord[]> {
  const uniqueCollections = Array.from(new Set(collections));

  const snapshots = await Promise.all(
    uniqueCollections.map(async (collectionName) => {
      const snapshot = await getDocs(collection(db, collectionName));
      return snapshot.docs.map((doc) => mapDocument(doc.data(), doc.id, collectionName));
    }),
  );

  return snapshots.flat();
}

function filterByStatus(records: CampusRecord[], status: StatusFilter): CampusRecord[] {
  if (status === 'any') {
    return records;
  }

  return records.filter((record) => record.status === status);
}

export function aggregateByIntent(records: CampusRecord[], intent: Intent): AggregateResult {
  const docsRead = records.length;
  const filtered = filterByStatus(records, intent.status);
  const extractor = metricExtractor[intent.metric];

  const total = filtered.reduce((sum, record) => sum + extractor(record), 0);

  const breakdown =
    intent.breakdown === 'collection'
      ? intent.collections.map((collectionName) => {
          const subtotal = filtered
            .filter((record) => record.__collection === collectionName)
            .reduce((sum, record) => sum + extractor(record), 0);
          return { collection: collectionName, value: subtotal };
        })
      : [];

  return {
    total,
    breakdown,
    docsRead,
    filteredCount: filtered.length,
    statusApplied: intent.status,
  };
}

/**
 * Fetch records from Firestore with status filter and sorting by a metric.
 * Uses Firestore composite indexes for optimal performance.
 */
export async function readByStatusSorted(
  collectionName: CollectionName,
  status: 'active' | 'inactive',
  metric: 'income' | 'rent' | 'salary' | 'electricity' | 'misc',
  order: 'asc' | 'desc',
  limit?: number
): Promise<CampusRecord[]> {
  const col = collection(db, collectionName);
  let q = query(col, where('status', '==', status), orderBy(metric, order));

  if (limit) {
    q = query(q, firestoreLimit(limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => mapDocument(doc.data(), doc.id, collectionName));
}

/**
 * Fetch records from Firestore with type filter and sorting by a metric.
 * Uses Firestore composite indexes for optimal performance.
 */
export async function readByTypeSorted(
  collectionName: CollectionName,
  typeValue: string,
  metric: 'income' | 'rent' | 'salary' | 'electricity' | 'misc',
  order: 'asc' | 'desc',
  limit?: number
): Promise<CampusRecord[]> {
  const col = collection(db, collectionName);
  let q = query(col, where('type', '==', typeValue), orderBy(metric, order));

  if (limit) {
    q = query(q, firestoreLimit(limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => mapDocument(doc.data(), doc.id, collectionName));
}

/**
 * Fetch records from Firestore with both status and type filters, sorting by a metric.
 * Uses Firestore composite indexes for optimal performance.
 */
export async function readByStatusTypeSorted(
  collectionName: CollectionName,
  status: 'active' | 'inactive',
  typeValue: string,
  metric: 'income' | 'rent' | 'salary' | 'electricity' | 'misc',
  order: 'asc' | 'desc',
  limit?: number
): Promise<CampusRecord[]> {
  const col = collection(db, collectionName);
  let q = query(col, where('status', '==', status), where('type', '==', typeValue), orderBy(metric, order));

  if (limit) {
    q = query(q, firestoreLimit(limit));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => mapDocument(doc.data(), doc.id, collectionName));
}

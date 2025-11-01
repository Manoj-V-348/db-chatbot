import { collection, getDocs, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../firebase';
import type {
  AggregateResult,
  CampusRecord,
  CollectionName,
  Intent,
  Metric,
  StatusFilter,
  SportsRecord,
  EducationRecord,
  Status,
  CampusType,
} from './types';
import { toNumber, expenditureOf, profitOf } from './format';

const metricExtractor: Record<Metric, (record: any) => number> = {
  income: (record) => record.income ?? 0,
  profit: (record) => record.profit ?? 0,
  expenditure: (record) => record.expenditure ?? 0,
  salary: (record) => record.salary ?? 0,
  rent: (record) => record.rent ?? 0,
  electricity: (record) => record.electricity ?? 0,
  misc: (record) => record.misc ?? 0,
  staff: (record) => record.staff ?? 0,
  medals: (record) => record.medals ?? 0,
  coaches: (record) => record.coaches ?? 0,
  events: (record) => record.events ?? 0,
  teams: (record) => record.teams ?? 0,
  sports_budget: (record) => record.budget ?? 0,
  students: (record) => record.students ?? 0,
  teachers: (record) => record.teachers ?? 0,
  pass_rate: (record) => record.pass_rate ?? 0,
  avg_grade: (record) => record.avg_grade ?? 0,
  dropout_rate: (record) => record.dropout_rate ?? 0,
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

/**
 * Fetch sports records from Firestore with optional filters and sorting
 */
export async function readSports(opts?: {
  status?: Status;
  type?: CampusType;
  orderField?: string;
  orderDir?: "asc" | "desc";
  limit?: number;
}): Promise<SportsRecord[]> {
  const col = collection(db, "sports");
  const terms: any[] = [];

  if (opts?.status) terms.push(where("status", "==", opts.status));
  if (opts?.type) terms.push(where("type", "==", opts.type));
  if (opts?.orderField) terms.push(orderBy(opts.orderField, opts.orderDir ?? "desc"));
  if (opts?.limit) terms.push(firestoreLimit(opts.limit));

  const qref = terms.length ? query(col, ...terms) : col;
  const snap = await getDocs(qref);

  return snap.docs.map(d => ({
    __collection: "sports" as const,
    code: toNumber(d.data().code),
    location: String(d.data().location ?? ""),
    name: String(d.data().name ?? ""),
    type: (d.data().type ?? "school") as CampusType,
    status: (d.data().status ?? "active") as Status,
    teams: d.data().teams !== undefined ? toNumber(d.data().teams) : undefined,
    coaches: d.data().coaches !== undefined ? toNumber(d.data().coaches) : undefined,
    playgrounds: d.data().playgrounds !== undefined ? toNumber(d.data().playgrounds) : undefined,
    events: d.data().events !== undefined ? toNumber(d.data().events) : undefined,
    medals: d.data().medals !== undefined ? toNumber(d.data().medals) : undefined,
    budget: d.data().budget !== undefined ? toNumber(d.data().budget) : undefined,
  }));
}

/**
 * Fetch education records from Firestore with optional filters and sorting
 */
export async function readEducation(opts?: {
  status?: Status;
  type?: CampusType;
  orderField?: string;
  orderDir?: "asc" | "desc";
  limit?: number;
}): Promise<EducationRecord[]> {
  const col = collection(db, "education");
  const terms: any[] = [];

  if (opts?.status) terms.push(where("status", "==", opts.status));
  if (opts?.type) terms.push(where("type", "==", opts.type));
  if (opts?.orderField) terms.push(orderBy(opts.orderField, opts.orderDir ?? "desc"));
  if (opts?.limit) terms.push(firestoreLimit(opts.limit));

  const qref = terms.length ? query(col, ...terms) : col;
  const snap = await getDocs(qref);

  return snap.docs.map(d => ({
    __collection: "education" as const,
    code: toNumber(d.data().code),
    location: String(d.data().location ?? ""),
    name: String(d.data().name ?? ""),
    type: (d.data().type ?? "school") as CampusType,
    status: (d.data().status ?? "active") as Status,
    students: d.data().students !== undefined ? toNumber(d.data().students) : undefined,
    teachers: d.data().teachers !== undefined ? toNumber(d.data().teachers) : undefined,
    pass_rate: d.data().pass_rate !== undefined ? toNumber(d.data().pass_rate) : undefined,
    avg_grade: d.data().avg_grade !== undefined ? toNumber(d.data().avg_grade) : undefined,
    dropout_rate: d.data().dropout_rate !== undefined ? toNumber(d.data().dropout_rate) : undefined,
    labs: d.data().labs !== undefined ? toNumber(d.data().labs) : undefined,
    library_books: d.data().library_books !== undefined ? toNumber(d.data().library_books) : undefined,
    programs: d.data().programs !== undefined ? toNumber(d.data().programs) : undefined,
  }));
}

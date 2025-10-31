import { useEffect, useMemo, useState } from 'react';
import { fetchCollections } from '../lib/data';
import { formatCollectionName, formatINR, formatMetricLabel, formatStatusLabel } from '../lib/format';
import { COLLECTIONS } from '../lib/types';
import type { CampusRecord, CollectionName } from '../lib/types';

type SortKey =
  | '__collection'
  | 'code'
  | 'name'
  | 'location'
  | 'status'
  | 'staff'
  | 'income'
  | 'rent'
  | 'salary'
  | 'electricity'
  | 'misc'
  | 'expenditure'
  | 'profit';

const collectionOrder = COLLECTIONS.reduce<Record<CollectionName, number>>((acc, name, index) => {
  acc[name] = index;
  return acc;
}, {} as Record<CollectionName, number>);

const statusOrder: Record<CampusRecord['status'], number> = {
  active: 0,
  inactive: 1,
  unknown: 2,
};

const headers: Array<{ key: SortKey; label: string; align?: 'left' | 'right' }> = [
  { key: '__collection', label: 'Collection' },
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
  { key: 'location', label: 'Location' },
  { key: 'status', label: 'Status' },
  { key: 'staff', label: 'Staff', align: 'right' },
  { key: 'income', label: formatMetricLabel('income'), align: 'right' },
  { key: 'rent', label: formatMetricLabel('rent'), align: 'right' },
  { key: 'salary', label: formatMetricLabel('salary'), align: 'right' },
  { key: 'electricity', label: formatMetricLabel('electricity'), align: 'right' },
  { key: 'misc', label: formatMetricLabel('misc'), align: 'right' },
  { key: 'expenditure', label: formatMetricLabel('expenditure'), align: 'right' },
  { key: 'profit', label: formatMetricLabel('profit'), align: 'right' },
];

const numberFormatter = new Intl.NumberFormat('en-IN');

export function DataTable() {
  const [selectedCollections, setSelectedCollections] = useState<CollectionName[]>(() => [...COLLECTIONS]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({
    key: 'name',
    direction: 'asc',
  });
  const [data, setData] = useState<CampusRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const identifier = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim().toLowerCase());
    }, 250);

    return () => {
      window.clearTimeout(identifier);
    };
  }, [searchTerm]);

  useEffect(() => {
    if (selectedCollections.length === 0) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    fetchCollections(selectedCollections)
      .then((records) => {
        if (!active) {
          return;
        }
        setData(records);
      })
      .catch((fetchError) => {
        console.error('Failed to load Firestore collections', fetchError);
        if (!active) {
          return;
        }
        setError('We could not load the data right now. Please retry.');
        setData([]);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedCollections]);

  const filteredRows = useMemo(() => {
    return data.filter((record) => {
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? record.status === 'active'
          : record.status === 'inactive';

      if (!matchesStatus) {
        return false;
      }

      if (!debouncedSearch) {
        return true;
      }

      const haystack = [
        record.name ?? '',
        record.location ?? '',
        record.code ?? '',
        formatCollectionName(record.__collection),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(debouncedSearch);
    });
  }, [data, debouncedSearch, statusFilter]);

  const sortedRows = useMemo(() => {
    const clone = [...filteredRows];
    clone.sort((a, b) => {
      let valueA: string | number = '';
      let valueB: string | number = '';

      switch (sort.key) {
        case '__collection':
          valueA = collectionOrder[a.__collection];
          valueB = collectionOrder[b.__collection];
          break;
        case 'status':
          valueA = statusOrder[a.status];
          valueB = statusOrder[b.status];
          break;
        case 'code':
          valueA = a.code ?? '';
          valueB = b.code ?? '';
          break;
        case 'name':
          valueA = a.name ?? '';
          valueB = b.name ?? '';
          break;
        case 'location':
          valueA = a.location ?? '';
          valueB = b.location ?? '';
          break;
        case 'staff':
          valueA = a.staff;
          valueB = b.staff;
          break;
        case 'income':
          valueA = a.income;
          valueB = b.income;
          break;
        case 'rent':
          valueA = a.rent;
          valueB = b.rent;
          break;
        case 'salary':
          valueA = a.salary;
          valueB = b.salary;
          break;
        case 'electricity':
          valueA = a.electricity;
          valueB = b.electricity;
          break;
        case 'misc':
          valueA = a.misc;
          valueB = b.misc;
          break;
        case 'expenditure':
          valueA = a.expenditure;
          valueB = b.expenditure;
          break;
        case 'profit':
          valueA = a.profit;
          valueB = b.profit;
          break;
        default:
          valueA = 0;
          valueB = 0;
      }

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sort.direction === 'asc' ? valueA - valueB : valueB - valueA;
      }

      return sort.direction === 'asc'
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });

    return clone;
  }, [filteredRows, sort]);

  const toggleCollection = (collection: CollectionName) => {
    setSelectedCollections((prev) => {
      if (prev.includes(collection)) {
        return prev.filter((item) => item !== collection);
      }
      return [...prev, collection];
    });
  };

  const setSortKey = (key: SortKey) => {
    setSort((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return {
        key,
        direction: key === '__collection' || key === 'name' || key === 'location' ? 'asc' : 'desc',
      };
    });
  };

  const handleExport = () => {
    if (sortedRows.length === 0) {
      return;
    }

    const csvRows = [
      headers.map((header) => header.label),
      ...sortedRows.map((row) => [
        formatCollectionName(row.__collection),
        row.code ?? '',
        row.name ?? '',
        row.location ?? '',
        formatStatusLabel(row.status),
        numberFormatter.format(row.staff),
        formatINR(row.income),
        formatINR(row.rent),
        formatINR(row.salary),
        formatINR(row.electricity),
        formatINR(row.misc),
        formatINR(row.expenditure),
        formatINR(row.profit),
      ]),
    ];

    const escapeCell = (cell: string) => `"${cell.replace(/"/g, '""')}"`;

    const csvContent = csvRows.map((row) => row.map((cell) => escapeCell(cell)).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `campus-finance-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const allCollectionsSelected = selectedCollections.length === COLLECTIONS.length;
  const docsCount = data.length;

  return (
    <section className="flex h-full flex-col gap-6">
      {/* Page header */}
      <div className="glass-card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-soft shadow-glow-sm">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Financial Data Explorer</h2>
            <p className="mt-1 text-sm text-slate-400">
              Filter, sort, and export comprehensive financial records from all collections
            </p>
          </div>
        </div>
      </div>

      {/* Filters and controls */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Collection filters */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span className="text-sm font-semibold uppercase tracking-wider text-slate-300">Collections</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {COLLECTIONS.map((collection) => {
                const selected = selectedCollections.includes(collection);
                return (
                  <label
                    key={collection}
                    className={`group relative cursor-pointer overflow-hidden rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-300 ease-gentle ${
                      selected
                        ? 'border-accent/50 bg-gradient-to-br from-accent/20 to-accent-soft/10 text-white shadow-pill-soft hover:shadow-pill'
                        : 'border-white/15 bg-white/5 text-slate-300 hover:border-white/30 hover:bg-white/8'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={selected}
                      onChange={() => toggleCollection(collection)}
                    />
                    <span className="relative z-10 flex items-center gap-2">
                      {selected && (
                        <svg className="h-4 w-4 text-accent-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                      {formatCollectionName(collection)}
                    </span>
                    {selected && (
                      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-accent-soft/5"></div>
                    )}
                  </label>
                );
              })}
            </div>
            {!allCollectionsSelected && selectedCollections.length === 0 && (
              <div className="flex items-center gap-2 text-xs font-medium text-error-light">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Select at least one collection to view data
              </div>
            )}
          </div>

          {/* Status and search filters */}
          <div className="flex flex-col gap-4 lg:w-96">
            {/* Status toggle */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                </svg>
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-300">Status Filter</span>
              </div>
              <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
                {(['all', 'active', 'inactive'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatusFilter(option)}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-all duration-300 ease-gentle ${
                      statusFilter === option
                        ? 'bg-gradient-to-br from-white/95 to-white/90 text-ink shadow-md'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {option === 'all' ? 'All' : option === 'active' ? 'Active' : 'Inactive'}
                  </button>
                ))}
              </div>
            </div>

            {/* Search input */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-300">Search</span>
              </div>
              <div className="group relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name or location..."
                  className="input-field h-12 w-full pl-11 pr-10 text-sm"
                />
                <svg
                  className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-ink"
                    aria-label="Clear search"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Results summary and export */}
        <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 font-medium text-slate-200">
              <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              <span className="font-semibold text-white">{sortedRows.length}</span>
              <span className="text-slate-400">of</span>
              <span className="font-semibold text-white">{docsCount}</span>
              <span className="text-slate-400">records</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="btn-primary flex h-12 items-center gap-2"
            disabled={sortedRows.length === 0}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export to CSV
          </button>
        </div>

        {/* Data table */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/4 shadow-elevation-soft backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-gradient-to-b from-white/10 to-white/5">
                  {headers.map((header) => {
                    const isActive = sort.key === header.key;
                    return (
                      <th
                        key={header.key}
                        scope="col"
                        onClick={() => setSortKey(header.key)}
                        className={`group cursor-pointer px-5 py-4 font-semibold transition-colors hover:bg-white/5 ${
                          header.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300 transition-colors group-hover:text-white">
                          {header.label}
                          <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                            {isActive ? (
                              sort.direction === 'asc' ? (
                                <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                              )
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                              </svg>
                            )}
                          </span>
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedRows.map((row, index) => (
                  <tr
                    key={`${row.__collection}-${row.id}`}
                    className="group transition-all duration-200 hover:bg-white/8"
                    style={{ animationDelay: `${index * 20}ms` }}
                  >
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-gradient-to-br from-accent/10 to-accent-soft/5 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                        {formatCollectionName(row.__collection)}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-200">{row.code}</td>
                    <td className="px-5 py-4 font-medium text-white">{row.name ?? '—'}</td>
                    <td className="px-5 py-4 text-slate-300">{row.location ?? '—'}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          row.status === 'active'
                            ? 'bg-success/15 text-success-light'
                            : row.status === 'inactive'
                            ? 'bg-slate-500/20 text-slate-300'
                            : 'bg-warning/20 text-warning-light'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          row.status === 'active' ? 'bg-success-light' : row.status === 'inactive' ? 'bg-slate-400' : 'bg-warning-light'
                        }`}></span>
                        {formatStatusLabel(row.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-white">
                      {numberFormatter.format(row.staff)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-100">{formatINR(row.income)}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-100">{formatINR(row.rent)}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-100">{formatINR(row.salary)}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-100">{formatINR(row.electricity)}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-100">{formatINR(row.misc)}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-100">{formatINR(row.expenditure)}</td>
                    <td className="px-5 py-4 text-right font-bold tabular-nums text-white">{formatINR(row.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {!loading && sortedRows.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-200">
                  {selectedCollections.length === 0
                    ? 'No collection selected'
                    : 'No matching records'}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedCollections.length === 0
                    ? 'Select at least one collection from the filters above'
                    : 'Try adjusting your filters or search criteria'}
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
              <div className="relative h-12 w-12">
                <div className="absolute inset-0 animate-spin rounded-full border-4 border-accent/20 border-t-accent"></div>
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-accent/20 to-accent-soft/20"></div>
              </div>
              <p className="text-sm font-medium text-slate-200">Loading financial data...</p>
            </div>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-error/40 bg-error/10 p-6 backdrop-blur-xl">
            <svg className="h-5 w-5 flex-shrink-0 text-error-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-error-light">Error loading data</p>
              <p className="mt-1 text-sm text-error-light/80">{error}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default DataTable;

import { useEffect, useState } from 'react';
import { readEducation } from '../lib/data';
import type { EducationRecord } from '../lib/types';

const numberFormatter = new Intl.NumberFormat('en-IN');

const formatPercent = (val: number | undefined): string => {
  if (val === undefined) return '—';
  return `${(val * 100).toFixed(1)}%`;
};

export function EducationTable() {
  const [data, setData] = useState<EducationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof EducationRecord | null>('pass_rate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    readEducation({ status: 'active' })
      .then((records) => {
        if (!active) return;
        setData(records);
      })
      .catch((err) => {
        console.error('Failed to load education data', err);
        if (!active) return;
        setError('Failed to load education data. Please retry.');
        setData([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSort = (field: keyof EducationRecord) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0;

    const aVal = a[sortField] ?? 0;
    const bVal = b[sortField] ?? 0;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    }

    return sortDir === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  return (
    <section className="flex h-full flex-col gap-6">
      {/* Page header */}
      <div className="glass-card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-soft shadow-glow-sm">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Education Data</h2>
            <p className="mt-1 text-sm text-slate-400">
              View and explore education metrics across all campuses
            </p>
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 font-medium text-slate-200">
            <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
            <span className="font-semibold text-white">{sortedData.length}</span>
            <span className="text-slate-400">records</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/4 shadow-elevation-soft backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-gradient-to-b from-white/10 to-white/5">
                  <th className="group cursor-pointer px-5 py-4 text-left font-semibold" onClick={() => handleSort('name')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Name</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-left font-semibold" onClick={() => handleSort('location')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Location</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-left font-semibold" onClick={() => handleSort('type')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Type</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-left font-semibold" onClick={() => handleSort('status')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Status</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-right font-semibold" onClick={() => handleSort('students')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Students</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-right font-semibold" onClick={() => handleSort('teachers')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Teachers</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-right font-semibold" onClick={() => handleSort('pass_rate')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">
                      Pass Rate
                      {sortField === 'pass_rate' && (
                        sortDir === 'asc' ? '↑' : '↓'
                      )}
                    </span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-right font-semibold" onClick={() => handleSort('avg_grade')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Avg Grade</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-right font-semibold" onClick={() => handleSort('dropout_rate')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Dropout Rate</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-right font-semibold" onClick={() => handleSort('labs')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Labs</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-right font-semibold" onClick={() => handleSort('library_books')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Library Books</span>
                  </th>
                  <th className="group cursor-pointer px-5 py-4 text-right font-semibold" onClick={() => handleSort('programs')}>
                    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-slate-300">Programs</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedData.map((row, index) => (
                  <tr
                    key={`${row.code}-${index}`}
                    className="group transition-all duration-200 hover:bg-white/8"
                  >
                    <td className="px-5 py-4 font-medium text-white">{row.name}</td>
                    <td className="px-5 py-4 text-slate-300">{row.location}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-gradient-to-br from-accent/10 to-accent-soft/5 px-3 py-1.5 text-xs font-semibold text-white capitalize">
                        {row.type}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                        row.status === 'active' ? 'bg-success/15 text-success-light' : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          row.status === 'active' ? 'bg-success-light' : 'bg-slate-400'
                        }`}></span>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-100">
                      {row.students !== undefined ? numberFormatter.format(row.students) : '—'}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-100">
                      {row.teachers !== undefined ? numberFormatter.format(row.teachers) : '—'}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-white">
                      {formatPercent(row.pass_rate)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-100">
                      {row.avg_grade !== undefined ? row.avg_grade.toFixed(1) : '—'}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-100">
                      {formatPercent(row.dropout_rate)}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-100">
                      {row.labs !== undefined ? numberFormatter.format(row.labs) : '—'}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-100">
                      {row.library_books !== undefined ? numberFormatter.format(row.library_books) : '—'}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-100">
                      {row.programs !== undefined ? numberFormatter.format(row.programs) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {!loading && sortedData.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-200">No education records found</p>
                <p className="mt-1 text-sm text-slate-400">Add some education data to get started</p>
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
              <p className="text-sm font-medium text-slate-200">Loading education data...</p>
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

export default EducationTable;

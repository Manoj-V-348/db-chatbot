import { useEffect, useState } from 'react';
import { fetchCollections, readSports, readEducation } from '../lib/data';
import { mergeByLocation, type MergedByLocation } from '../lib/merge';
import { formatINR } from '../lib/format';
import { COLLECTIONS } from '../lib/types';

const numberFormatter = new Intl.NumberFormat('en-IN');

const formatPercent = (val: number | undefined): string => {
  if (val === undefined) return '—';
  return `${(val * 100).toFixed(1)}%`;
};

export function MergedLocationTable() {
  const [data, setData] = useState<MergedByLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchCollections([...COLLECTIONS]),
      readSports(),
      readEducation(),
    ])
      .then(([finance, sports, education]) => {
        if (!active) return;
        const merged = mergeByLocation(finance, sports, education);
        setData(merged);
      })
      .catch((err) => {
        console.error('Failed to load merged data', err);
        if (!active) return;
        setError('Failed to load merged data. Please retry.');
        setData([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex h-full flex-col gap-6">
      {/* Page header */}
      <div className="glass-card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-soft shadow-glow-sm">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">Merged by Location</h2>
            <p className="mt-1 text-sm text-slate-400">
              Comprehensive view of finance, sports, and education data aggregated by location
            </p>
          </div>
        </div>
      </div>

      {/* Data table */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 font-medium text-slate-200">
            <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span className="font-semibold text-white">{data.length}</span>
            <span className="text-slate-400">locations</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/8 to-white/4 shadow-elevation-soft backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-gradient-to-b from-white/10 to-white/5">
                  <th className="px-5 py-4 text-left font-semibold">
                    <span className="text-xs uppercase tracking-wider text-slate-300">Location</span>
                  </th>
                  <th className="px-5 py-4 text-right font-semibold" colSpan={3}>
                    <span className="text-xs uppercase tracking-wider text-slate-300">Finance Summary</span>
                  </th>
                  <th className="px-5 py-4 text-right font-semibold" colSpan={4}>
                    <span className="text-xs uppercase tracking-wider text-slate-300">Sports</span>
                  </th>
                  <th className="px-5 py-4 text-right font-semibold" colSpan={3}>
                    <span className="text-xs uppercase tracking-wider text-slate-300">Education</span>
                  </th>
                </tr>
                <tr className="border-b border-white/10 bg-gradient-to-b from-white/10 to-white/5">
                  <th className="px-5 py-3 text-left font-semibold">
                    <span className="text-xs text-slate-400"></span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Income</span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Expenditure</span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Profit</span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Teams</span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Coaches</span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Medals</span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Budget</span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Students</span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Pass Rate</span>
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    <span className="text-xs text-slate-400">Avg Grade</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((row, index) => {
                  // Calculate finance totals for this location
                  const financeIncome = row.finance?.reduce((sum, f) => sum + f.income, 0) ?? 0;
                  const financeExpenditure = row.finance?.reduce((sum, f) => sum + f.expenditure, 0) ?? 0;
                  const financeProfit = row.finance?.reduce((sum, f) => sum + f.profit, 0) ?? 0;

                  return (
                    <tr
                      key={`${row.location}-${index}`}
                      className="group transition-all duration-200 hover:bg-white/8"
                    >
                      <td className="px-5 py-4 font-medium text-white">{row.location}</td>

                      {/* Finance columns */}
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-100">
                        {financeIncome > 0 ? formatINR(financeIncome) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-100">
                        {financeExpenditure > 0 ? formatINR(financeExpenditure) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-bold tabular-nums text-white">
                        {financeProfit !== 0 ? formatINR(financeProfit) : '—'}
                      </td>

                      {/* Sports columns */}
                      <td className="px-5 py-4 text-right font-semibold text-slate-100">
                        {row.sports?.teams !== undefined ? numberFormatter.format(row.sports.teams) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-100">
                        {row.sports?.coaches !== undefined ? numberFormatter.format(row.sports.coaches) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-white">
                        {row.sports?.medals !== undefined ? numberFormatter.format(row.sports.medals) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold tabular-nums text-slate-100">
                        {row.sports?.budget !== undefined ? formatINR(row.sports.budget) : '—'}
                      </td>

                      {/* Education columns */}
                      <td className="px-5 py-4 text-right font-semibold text-slate-100">
                        {row.education?.students !== undefined ? numberFormatter.format(row.education.students) : '—'}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-white">
                        {formatPercent(row.education?.pass_rate)}
                      </td>
                      <td className="px-5 py-4 text-right font-semibold text-slate-100">
                        {row.education?.avg_grade !== undefined ? row.education.avg_grade.toFixed(1) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty state */}
          {!loading && data.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-200">No location data found</p>
                <p className="mt-1 text-sm text-slate-400">Add some data to get started</p>
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
              <p className="text-sm font-medium text-slate-200">Loading merged data...</p>
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

export default MergedLocationTable;

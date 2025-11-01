import type { CampusRecord, SportsRecord, EducationRecord } from "./types";

export interface MergedByLocation {
  location: string;
  finance?: CampusRecord[];
  sports?: SportsRecord | null;
  education?: EducationRecord | null;
}

export function mergeByLocation(
  finance: CampusRecord[],
  sports: SportsRecord[],
  education: EducationRecord[]
): MergedByLocation[] {
  const map = new Map<string, MergedByLocation>();

  const getOrCreate = (loc: string): MergedByLocation => {
    if (!map.has(loc)) {
      map.set(loc, { location: loc, finance: [] });
    }
    return map.get(loc)!;
  };

  // Add all finance records grouped by location
  for (const f of finance) {
    const loc = String(f.location ?? "");
    getOrCreate(loc).finance!.push(f);
  }

  // Add sports records (one per location)
  for (const s of sports) {
    const loc = String(s.location ?? "");
    getOrCreate(loc).sports = s;
  }

  // Add education records (one per location)
  for (const e of education) {
    const loc = String(e.location ?? "");
    getOrCreate(loc).education = e;
  }

  return [...map.values()];
}

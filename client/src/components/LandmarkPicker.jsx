import { useMemo, useState } from "react";

const CATEGORY_LABELS = {
  RESIDENCE: "Hostels & residence",
  ACADEMIC: "Academic",
  ADMINISTRATION: "Administration",
  FOOD: "Food",
  SPORTS: "Sports",
  HEALTH: "Health",
  RELIGIOUS: "Religious",
  TRANSPORT: "Gates & transport",
  OTHER: "Other",
};

const CATEGORY_ORDER = [
  "RESIDENCE",
  "ACADEMIC",
  "ADMINISTRATION",
  "FOOD",
  "SPORTS",
  "HEALTH",
  "RELIGIOUS",
  "TRANSPORT",
  "OTHER",
];

const normalize = (value) => String(value || "").toLowerCase();

export default function LandmarkPicker({
  landmarks,
  value,
  onChange,
  loading = false,
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query).trim();
    if (!q) return landmarks;
    return landmarks.filter((landmark) => {
      const haystack = [landmark.name, ...(landmark.aliases || [])]
        .map(normalize)
        .join(" ");
      return haystack.includes(q);
    });
  }, [landmarks, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const landmark of filtered) {
      const category = CATEGORY_ORDER.includes(landmark.category)
        ? landmark.category
        : "OTHER";
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(landmark);
    }
    return CATEGORY_ORDER.filter((category) => map.has(category)).map(
      (category) => [category, map.get(category)]
    );
  }, [filtered]);

  if (loading) {
    return (
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3">
        <label htmlFor="landmark-search" className="sr-only">
          Search campus drop-off points
        </label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-500">
            search
          </span>
          <input
            id="landmark-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search buildings, hostels, gates..."
            className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          No drop-off point matches that search.
        </p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          {grouped.map(([category, categoryLandmarks]) => (
            <div key={category}>
              <p className="sticky top-0 bg-slate-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="divide-y divide-slate-50">
                {categoryLandmarks.map((landmark) => {
                  const selected = value === landmark.id;
                  const noPin = landmark.lat == null || landmark.lng == null;
                  return (
                    <button
                      key={landmark.id}
                      type="button"
                      onClick={() => onChange(landmark)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                        selected
                          ? "bg-amber-50"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {landmark.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {noPin
                            ? "No map pin yet — use your current location"
                            : CATEGORY_LABELS[landmark.category] || "Drop-off point"}
                        </span>
                      </span>
                      {selected && (
                        <span className="material-symbols-outlined shrink-0 text-amber-700">
                          check_circle
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

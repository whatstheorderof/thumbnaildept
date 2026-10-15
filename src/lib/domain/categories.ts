export const DEFAULT_CATEGORIES = [
  "Gaming", "Finance", "Business", "Fitness", "Lifestyle", "Travel", "Technology", "Commentary",
  "Documentary", "Food", "Football", "Beauty", "Fashion", "Podcasts", "True Crime", "Education",
] as const;

export type Category = (typeof DEFAULT_CATEGORIES)[number];

export const MARKETPLACES = [
  { value: "fiverr", label: "Fiverr" },
  { value: "upwork", label: "Upwork" },
  { value: "direct", label: "Direct" },
  { value: "other", label: "Other" },
] as const;

export const marketplaceLabel = (m: string) => MARKETPLACES.find((x) => x.value === m)?.label ?? m;

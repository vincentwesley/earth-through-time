// Places for the picker: city-centre coordinates rounded to 0.01° (public facts).
// Singapore is the default pin and keeps its own model-specific notes.

export interface Place {
  slug: string;
  name: string;
  lat: number;
  lon: number;
}

export const PLACES: Place[] = [
  { slug: "singapore", name: "Singapore", lat: 1.29, lon: 103.85 },
  { slug: "anchorage", name: "Anchorage", lat: 61.22, lon: -149.9 },
  { slug: "auckland", name: "Auckland", lat: -36.85, lon: 174.76 },
  { slug: "beijing", name: "Beijing", lat: 39.9, lon: 116.41 },
  { slug: "buenos-aires", name: "Buenos Aires", lat: -34.6, lon: -58.38 },
  { slug: "cairo", name: "Cairo", lat: 30.04, lon: 31.24 },
  { slug: "cape-town", name: "Cape Town", lat: -33.92, lon: 18.42 },
  { slug: "delhi", name: "Delhi", lat: 28.61, lon: 77.21 },
  { slug: "honolulu", name: "Honolulu", lat: 21.31, lon: -157.86 },
  { slug: "jakarta", name: "Jakarta", lat: -6.21, lon: 106.85 },
  { slug: "lima", name: "Lima", lat: -12.05, lon: -77.04 },
  { slug: "london", name: "London", lat: 51.51, lon: -0.13 },
  { slug: "mexico-city", name: "Mexico City", lat: 19.43, lon: -99.13 },
  { slug: "moscow", name: "Moscow", lat: 55.76, lon: 37.62 },
  { slug: "mumbai", name: "Mumbai", lat: 19.08, lon: 72.88 },
  { slug: "nairobi", name: "Nairobi", lat: -1.29, lon: 36.82 },
  { slug: "new-york", name: "New York", lat: 40.71, lon: -74.01 },
  { slug: "paris", name: "Paris", lat: 48.86, lon: 2.35 },
  { slug: "perth", name: "Perth", lat: -31.95, lon: 115.86 },
  { slug: "reykjavik", name: "Reykjavík", lat: 64.15, lon: -21.94 },
  { slug: "rio-de-janeiro", name: "Rio de Janeiro", lat: -22.91, lon: -43.17 },
  { slug: "san-francisco", name: "San Francisco", lat: 37.77, lon: -122.42 },
  { slug: "sydney", name: "Sydney", lat: -33.87, lon: 151.21 },
  { slug: "tokyo", name: "Tokyo", lat: 35.68, lon: 139.69 },
  { slug: "vancouver", name: "Vancouver", lat: 49.28, lon: -123.12 },
];

export function placeBySlug(slug: string | null): Place | undefined {
  return PLACES.find((p) => p.slug === slug);
}

// src/lib/swr.ts
// SWR 共享 fetcher
export const fetcher = (url: string) => fetch(url).then((res) => res.json());

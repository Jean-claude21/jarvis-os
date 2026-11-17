import { useQuery } from '@tanstack/react-query';
import { api } from './api';

// A kind's name in her words: its model's label, else the common type's, else the kind itself.

export interface Kind {
  kind: string;
  count: number;
  facets?: { facet: string }[];
  model?: { app?: string; label?: Record<string, string> };
  common?: { fr: string; en: string };
}

export function useKinds() {
  return useQuery({
    queryKey: ['kinds'],
    queryFn: () => api<Kind[]>('/kinds'),
    staleTime: 300_000,
  });
}

export function useKindName(): (kind: string) => string {
  const { data } = useKinds();
  const names = new Map(
    (data ?? []).map((one) => [one.kind, one.model?.label?.fr ?? one.common?.fr ?? one.kind]),
  );
  return (kind) => names.get(kind) ?? kind;
}

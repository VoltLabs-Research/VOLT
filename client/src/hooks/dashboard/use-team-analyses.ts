import { useEffect, useMemo, useRef, useState } from 'react';
import api from '@/api';

type TeamAnalysesItem = {
  _id: string;
  trajectory?: { _id: string; name: string } | string;
  timestep?: number;
  analysisMethod?: string;
  createdAt?: string;
  totalAtoms?: number;
  identificationRate?: number;
};

type TeamAnalysesResponse = {
  trajectories: Array<{ _id: string; name: string; createdAt: string }>;
  totalAnalyses: number;
  page: number;
  limit: number;
  analysesByTrajectory: Record<string, TeamAnalysesItem[]>;
};

export const useTeamAnalyses = (teamId?: string, opts?: { limit?: number; force?: boolean }) => {
  const limit = Math.max(1, Math.min(50, opts?.limit ?? 6));
  const [items, setItems] = useState<TeamAnalysesItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!teamId) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await api.get<{ status: string; data: TeamAnalysesResponse }>(
          `/structure-analysis/team/${teamId}`,
          { params: { page: 1, limit, sort: '-createdAt' }, signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        const data = res.data?.data;
        const map = data?.analysesByTrajectory || {};
        const flattened: TeamAnalysesItem[] = Object.values(map).flat();
        // Sort by createdAt desc as a guard (server already sorts)
        flattened.sort((a, b) => (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime()));
        setItems(flattened.slice(0, limit));
      } catch (err: any) {
        if (controller.signal.aborted) {
          setLoading(false);
          return;
        }
        console.error('Error loading team analyses');
        const message = err?.response?.data?.message || err?.message || 'Failed to load analyses';
        setError(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [teamId, limit, opts?.force]);

  const compact = useMemo(() => items.map((it) => ({
    id: it._id,
    trajectoryName: typeof it.trajectory === 'object' && it.trajectory ? (it.trajectory as any).name : '',
    timestep: it.timestep,
    method: it.analysisMethod,
    createdAt: it.createdAt
  })), [items]);

  return { items: compact, loading, error };
};

export default useTeamAnalyses;

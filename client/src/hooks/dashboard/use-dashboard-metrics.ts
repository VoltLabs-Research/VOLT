import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/services/api';
import type { ApiResponse } from '@/types/api';

type MetricKey = 'structureAnalysis' | 'trajectories' | 'dislocations';

interface TrajectoryMetrics {
    totals: Record<MetricKey, number>;
    lastMonth: Record<MetricKey, number>;
    weekly: {
        labels: string[];
        structureAnalysis: number[];
        trajectories: number[];
        dislocations: number[];
    };
}

type CacheEntry = { data: TrajectoryMetrics; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<TrajectoryMetrics>>();

const abbreviate = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}b`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}m`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}k`;
    return `${n}`;
};

const toNumericArray = (arr: unknown[]) => (arr || []).map((v) => Number(v) || 0);

const withPaddingDomain = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 };
    if (min === max) {
        const pad = max === 0 ? 1 : Math.abs(max) * 0.1;
        return { min: Math.min(0, max - pad), max: max + pad };
    }
    const span = max - min;
    const pad = Math.max(1e-6, span * 0.1);
    return { min: min - pad, max: max + pad };
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

const buildFullWeekLabels = (lastLabel?: string, count: number = 12) => {
    const end = lastLabel ? new Date(`${lastLabel}T00:00:00Z`) : new Date();
    const out: string[] = [];
    for (let i = count - 1; i >= 0; i--){
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() - i * 7);
        d.setUTCHours(0, 0, 0, 0);
        out.push(iso(d));
    }
    return out;
};

const padSeriesToLabels = (labels: string[], series: number[], desired = 12) => {
    const map = new Map<string, number>();
    for (let i = 0; i < labels.length; i++){
        map.set(labels[i], Number(series[i]) || 0);
    }
    const fullLabels = buildFullWeekLabels(labels[labels.length - 1], desired);
    const fullSeries = fullLabels.map((k) => map.get(k) ?? 0);
    return { fullLabels, fullSeries };
};

const keyOf = (teamId?: string) => teamId || 'all';

const fetchOnce = (teamId?: string, signal?: AbortSignal) => {
    const key = keyOf(teamId);
    if (inFlight.has(key)) return inFlight.get(key)!;
    const p = api
        .get<ApiResponse<TrajectoryMetrics>>('/trajectories/metrics', { params: teamId ? { teamId } : undefined, signal })
        .then((res) => res.data.data)
        .finally(() => {
            inFlight.delete(key);
        });
    inFlight.set(key, p);
    return p;
};

export const useDashboardMetrics = (
    teamId?: string,
    opts?: { ttlMs?: number; force?: boolean; }
) => {
    const key = keyOf(teamId);
    const ttlMs = opts?.ttlMs ?? 5 * 60 * 1000;

    const [data, setData] = useState<TrajectoryMetrics | null>(() => {
        const hit = cache.get(key);
        if (!hit) return null;
        return hit.data;
    });
    const [loading, setLoading] = useState<boolean>(() => !cache.has(key));
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const hit = cache.get(key);
        const expired = hit ? Date.now() - hit.fetchedAt > ttlMs : true;
        const shouldFetch = opts?.force ? true : expired;

        if (!shouldFetch && hit) {
            setData(hit.data);
            setLoading(false);
            setError(null);
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        fetchOnce(teamId, controller.signal)
            .then((payload) => {
                if (controller.signal.aborted) return;
                cache.set(key, { data: payload, fetchedAt: Date.now() });
                setData(payload);
                setLoading(false);
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                //setError(err?.response?.data?.message || 'Failed to load metrics');
                //setLoading(false);
            });

        return () => {
            controller.abort();
        };
    }, [key, teamId, ttlMs, opts?.force]);

    const cards = useMemo(() => {
        if (!data) return [];
        const baseLabels = data.weekly.labels || [];
        const sStruct = toNumericArray(data.weekly.structureAnalysis as any);
        const sTraj = toNumericArray(data.weekly.trajectories as any);
        const sDisl = toNumericArray(data.weekly.dislocations as any);
        const { fullLabels: labelsS, fullSeries: seriesS } = padSeriesToLabels(baseLabels, sStruct, 12);
        const { fullLabels: labelsT, fullSeries: seriesT } = padSeriesToLabels(baseLabels, sTraj, 12);
        const { fullLabels: labelsD, fullSeries: seriesD } = padSeriesToLabels(baseLabels, sDisl, 12);
        const dStruct = withPaddingDomain(seriesS);
        const dTraj = withPaddingDomain(seriesT);
        const dDisl = withPaddingDomain(seriesD);
        return [
            {
                key: 'structureAnalysis' as MetricKey,
                name: 'Structure Analysis',
                listingUrl: '/dashboard/structure-analysis/list',
                count: abbreviate(Number(data.totals.structureAnalysis) || 0),
                lastMonthStatus: Number(data.lastMonth.structureAnalysis) || 0,
                series: seriesS,
                labels: labelsS,
                yDomain: dStruct
            },
            {
                key: 'trajectories' as MetricKey,
                name: 'Trajectories',
                listingUrl: '/dashboard/trajectories/list',
                count: abbreviate(Number(data.totals.trajectories) || 0),
                lastMonthStatus: Number(data.lastMonth.trajectories) || 0,
                series: seriesT,
                labels: labelsT,
                yDomain: dTraj
            },
            {
                key: 'dislocations' as MetricKey,
                name: 'Dislocations',
                listingUrl: '/dashboard/dislocations/list',
                count: abbreviate(Number(data.totals.dislocations) || 0),
                lastMonthStatus: Number(data.lastMonth.dislocations) || 0,
                series: seriesD,
                labels: labelsD,
                yDomain: dDisl
            }
        ];
    }, [data]);

    return { loading, error, data, cards };
};

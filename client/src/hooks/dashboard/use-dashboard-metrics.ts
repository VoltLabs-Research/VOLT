import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api';
import type { ApiResponse } from '@/types/api';

type MetricKey = 'structureAnalysis' | 'trajectories' | 'analysisConfigs' | 'dislocations';

interface TrajectoryMetrics{
    totals: Record<MetricKey, number>;
    lastMonth: Record<MetricKey, number>;
    weekly: {
        labels: string[];
        structureAnalysis: number[];
        trajectories: number[];
    analysisConfigs?: number[];
        dislocations: number[];
    };
}

type CacheEntry = { data: TrajectoryMetrics; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<TrajectoryMetrics>>();

const keyOf = (teamId?: string) => teamId || 'all';

const abbreviate = (n: number) => {
    const abs = Math.abs(n);
    if(abs >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}b`;
    if(abs >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}m`;
    if(abs >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}k`;
    return `${n}`;
};

const toNumericArray = (arr: unknown[]) => (arr || []).map((v) => Number(v) || 0);

const withPaddingDomain = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if(!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 };
    if(min === max){
        const pad = max === 0 ? 1 : Math.abs(max) * 0.1;
        return { min: Math.min(0, max - pad), max: max + pad };
    }
    const span = max - min;
    const pad = Math.max(1e-6, span * 0.1);
    return { min: min - pad, max: max + pad };
};

const padSeries = (baseLabels: string[], series: number[], desired = 12) => {
    const last = baseLabels[baseLabels.length - 1];
    const end = last ? new Date(`${last}T00:00:00Z`) : new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const map = new Map<string, number>();
    for(let i = 0; i < baseLabels.length; i++) map.set(baseLabels[i], Number(series[i]) || 0);

    const labels: string[] = [];
    for(let i = desired - 1; i >= 0; i--){
        const d = new Date(end);
        d.setUTCDate(d.getUTCDate() - i * 7);
        d.setUTCHours(0, 0, 0, 0);
        labels.push(iso(d));
    }
    const full = labels.map((k) => map.get(k) ?? 0);
    return { labels, series: full };
};

const fetchOnce = (teamId?: string) => {
    const key = keyOf(teamId);
    if(inFlight.has(key)) return inFlight.get(key)!;

    const p = api
        .get<ApiResponse<TrajectoryMetrics>>('/trajectories/metrics', {
            params: teamId ? { teamId } : undefined
        })
        .then((res) => res.data.data)
        .finally(() => { inFlight.delete(key); });

    inFlight.set(key, p);
    return p;
};

export const useDashboardMetrics = (
    teamId?: string,
    opts?: { ttlMs?: number; force?: boolean; }
) => {
    const key = keyOf(teamId);
    const ttlMs = opts?.ttlMs ?? 5 * 60 * 1000;
    const [data, setData] = useState<TrajectoryMetrics | null>(() => cache.get(key)?.data ?? null);
    const [loading, setLoading] = useState<boolean>(() => !teamId || !cache.has(key));
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Don't fetch if teamId is required but not provided
        if(!teamId){
            setLoading(true);
            setData(null);
            setError(null);
            return;
        }

        const hit = cache.get(key);
        const expired = hit ? Date.now() - hit.fetchedAt > ttlMs : true;
        const shouldFetch = opts?.force || expired;

        if(!shouldFetch && hit){
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

    (async () => {
            try{
        const payload = await fetchOnce(teamId);
                if(controller.signal.aborted) return;

                cache.set(key, { data: payload, fetchedAt: Date.now() });
                setData(payload);
                setError(null);
            }catch(err: any){
        // Treat both local aborts and axios cancel-like errors as non-fatal
        const isCanceled = controller.signal.aborted || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || String(err?.message || '').toLowerCase() === 'canceled';
        if(isCanceled){
                    // Avoid a stuck spinner on aborts.
                    setLoading(false);
                    return;
                }
                const message =
                    err?.response?.data?.message ||
                    err?.message ||
                    'Failed to load metrics';
                setError(message);
            }finally{
                if(!controller.signal.aborted) setLoading(false);
            }
        })();

        return () => {
            controller.abort();
        };
    }, [key, teamId, ttlMs, opts?.force]);

    const cards = useMemo(() => {
    if(!data) return [] as any[];
    const base = data.weekly.labels || [];
    const sStruct = toNumericArray((data.weekly as any).structureAnalysis || []);
    const sTraj = toNumericArray((data.weekly as any).trajectories || []);
    const sCfg = toNumericArray((data.weekly as any).analysisConfigs || []);
    const sDisl = toNumericArray((data.weekly as any).dislocations || []);

        const ps = padSeries(base, sStruct, 12);
        const pt = padSeries(base, sTraj, 12);
    const pc = padSeries(base, sCfg, 12);
    const pd = padSeries(base, sDisl, 12);

        return [
            {
                key: 'structureAnalysis' as MetricKey,
                name: 'Structure Analysis',
                listingUrl: '/dashboard/structure-analysis/list',
                count: abbreviate(Number(data.totals.structureAnalysis) || 0),
                lastMonthStatus: Number(data.lastMonth.structureAnalysis) || 0,
                series: ps.series,
                labels: ps.labels,
                yDomain: withPaddingDomain(ps.series)
            },
            {
                key: 'trajectories' as MetricKey,
                name: 'Trajectories',
                listingUrl: '/dashboard/trajectories/list',
                count: abbreviate(Number(data.totals.trajectories) || 0),
                lastMonthStatus: Number(data.lastMonth.trajectories) || 0,
                series: pt.series,
                labels: pt.labels,
                yDomain: withPaddingDomain(pt.series)
            },
            {
                key: 'analysisConfigs' as MetricKey,
                name: 'Analysis Configs',
                listingUrl: '/dashboard/analysis-configs/list',
                count: abbreviate(Number((data.totals as any).analysisConfigs) || 0),
                lastMonthStatus: Number((data.lastMonth as any).analysisConfigs) || 0,
                series: pc.series,
                labels: pc.labels,
                yDomain: withPaddingDomain(pc.series)
            },
            {
                key: 'dislocations' as MetricKey,
                name: 'Dislocations',
                listingUrl: '/dashboard/dislocations/list',
                count: abbreviate(Number(data.totals.dislocations) || 0),
                lastMonthStatus: Number(data.lastMonth.dislocations) || 0,
                series: pd.series,
                labels: pd.labels,
                yDomain: withPaddingDomain(pd.series)
            }
        ];
    }, [data]);

    return { loading, error, data, cards };
};

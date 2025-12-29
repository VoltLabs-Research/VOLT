import { useEffect, useMemo, useRef, useState } from 'react';
import trajectoryApi from '@/services/api/trajectory/trajectory';

export type MetricKey = 'trajectories' | 'analysis' | string;

export interface MetricsMetaEntry {
    displayName?: string;
    listingUrl?: string;
    pluginName?: string;
}

export interface TrajectoryMetrics {
    totals: Record<string, number>;
    lastMonth: Record<string, number>;
    weekly: {
        labels: string[];
        [series: string]: number[] | string[];
    };
    meta?: Record<string, MetricsMetaEntry>;
}

export type CacheEntry = {
    data: TrajectoryMetrics;
    fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<TrajectoryMetrics>>();

const toNumericArray = (arr: unknown[]) => (arr || []).map((v) => Number(v) || 0);
const keyOf = (teamId?: string) => teamId || 'all';

const abbreviate = (n: number) => {
    const abs = Math.abs(n);
    if (abs >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}b`;
    if (abs >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}m`;
    if (abs >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}k`;
    return `${n}`;
};

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

const padSeries = (baseLabels: string[], series: number[], desired = 12) => {
    const last = baseLabels[baseLabels.length - 1];
    const end = last ? new Date(`${last}T00:00:00Z`) : new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const map = new Map<string, number>();
    for (let i = 0; i < baseLabels.length; i++) {
        map.set(baseLabels[i], Number(series[i]) || 0);
    }

    const labels: string[] = [];
    for (let i = desired - 1; i >= 0; i--) {
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
    if (inFlight.has(key)) return inFlight.get(key)!;

    const p = trajectoryApi.getMetrics()
        .then((data) => data as TrajectoryMetrics)
        .finally(() => inFlight.delete(key));

    inFlight.set(key, p);
    return p;
};

const buildCard = (
    data: TrajectoryMetrics,
    metricKey: string,
    baseLabels: string[],
    fallbackName: string,
    fallbackUrl?: string
) => {
    const meta = data.meta?.[metricKey];
    const name = meta?.displayName ?? fallbackName;
    const listingUrl = meta?.listingUrl ?? fallbackUrl;
    const pluginName = meta?.pluginName;

    const rawSeries = toNumericArray((data.weekly as any)[metricKey] || []);
    const padded = padSeries(baseLabels, rawSeries, 12);
    const rawCount = Number((data.totals as any)[metricKey]) || 0;

    return {
        key: metricKey as MetricKey,
        name,
        listingUrl,
        pluginName,
        count: abbreviate(rawCount),
        rawCount,
        lastMonthStatus: Number((data.lastMonth as any)[metricKey]) || 0,
        series: padded.series,
        labels: padded.labels,
        yDomain: withPaddingDomain(padded.series)
    };
};

const useDashboardMetrics = (
    teamId?: string,
    _trajectoryId?: string,
    opts?: { ttlMs?: number; force?: boolean }
) => {
    const key = keyOf(teamId);
    const ttlMs = opts?.ttlMs ?? 5 * 60 * 1000;
    const [data, setData] = useState<TrajectoryMetrics | null>(() => cache.get(key)?.data ?? null);
    const [loading, setLoading] = useState<boolean>(() => !teamId || !cache.has(key));
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);

    const fetchData = async () => {
        try {
            const payload = await fetchOnce(teamId);
            if (abortRef.current?.signal.aborted) return;

            cache.set(key, { data: payload, fetchedAt: Date.now() });
            setData(payload);
            setError(null);
        } catch (err: any) {
            const isCanceled =
                abortRef.current?.signal.aborted ||
                err?.code === 'ERR_CANCELED' ||
                err?.name === 'CanceledError' ||
                String(err?.message || '').toLowerCase() === 'canceled';

            if (isCanceled) {
                setLoading(false);
                return;
            }

            const message = err?.response?.data?.message || err?.message || 'Failed to load metrics';
            setError(message);
        } finally {
            if (!abortRef.current?.signal.aborted) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        if (!teamId) {
            setLoading(true);
            setData(null);
            setError(null);
            return;
        }

        const hit = cache.get(key);
        const expired = hit ? Date.now() - hit.fetchedAt > ttlMs : true;
        const shouldFetch = opts?.force || expired;

        if (!shouldFetch && hit) {
            setData(hit.data);
            setLoading(false);
            setError(null);
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        fetchData();

        return () => {
            controller.abort();
        };
    }, [key, teamId, ttlMs, opts?.force]);

    const cards = useMemo(() => {
        if (!data) return [];
        const baseLabels = data.weekly.labels || [];

        // Static cards for trajectories and analyses
        const staticCards = [
            buildCard(data, 'trajectories', baseLabels, 'Trajectories', '/dashboard/trajectories/list'),
            buildCard(data, 'analysis', baseLabels, 'Analyses', '/dashboard/analysis-configs/list')
        ];

        // Dynamic cards from backend metrics(plugins are now included in backend response)
        const dynamicKeys = Object.keys(data.totals).filter((k) => !['trajectories', 'analysis'].includes(k));
        const dynamicCards = dynamicKeys.map((k) => buildCard(data, k, baseLabels, k));

        // Combine and sort by count descending
        let allCards = [...staticCards, ...dynamicCards];
        allCards.sort((a, b) => b.rawCount - a.rawCount);

        // Take top 3
        allCards = allCards.slice(0, 3);

        // Sort by rawCount ascending so max count is last(for UI display purposes)
        allCards.sort((a, b) => a.rawCount - b.rawCount);

        return allCards;
    }, [data]);

    return { loading, error, data, cards };
};

export default useDashboardMetrics;

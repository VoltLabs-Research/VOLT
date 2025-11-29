/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api';
import type { ApiResponse } from '@/types/api';
import usePluginStore from '@/stores/plugins';

export type MetricKey = 'trajectories' | 'analysis' | string;

export interface MetricsMetaEntry{
    displayName?: string;
    listingUrl?: string;
};

export interface TrajectoryMetrics {
    totals: Record<string, number>;
    lastMonth: Record<string, number>;
    weekly: {
        labels: string[];
        [series: string]: number[] | string[];
    };
    meta?: Record<string, MetricsMetaEntry>;
};

export type CacheEntry = {
    data: TrajectoryMetrics,
    fetchedAt: number
};

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<TrajectoryMetrics>>();

const toNumericArray = (arr: unknown[]) => (arr || []).map((v) => Number(v) || 0);
const keyOf = (teamId?: string) => teamId || 'all';

const abbreviate = (n: number) => {
    const abs = Math.abs(n);
    if(abs >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}b`;
    if(abs >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}m`;
    if(abs >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}k`;
    return `${n}`;
};

const withPaddingDomain = (values: number[]) => {
    const min = Math.min(...values);
    const max = Math.max(...values);
    if(!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 };
    if(min === max){
        const pad = max === 0 ? 1 : Math.abs(max) * 0.1;
        return {
            min: Math.min(0, max - pad), 
            max: max + pad 
        };
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
    for(let i = 0; i < baseLabels.length; i++){
        map.set(baseLabels[i], Number(series[i]) || 0);
    }

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

    const rawSeries = toNumericArray((data.weekly as any)[metricKey] || []);
    const padded = padSeries(baseLabels, rawSeries, 12);
    const rawCount = Number((data.totals as any)[metricKey]) || 0;

    return {
        key: metricKey as MetricKey,
        name,
        listingUrl,
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
    trajectoryId?: string,
    opts?: { ttlMs?: number, force?: boolean }
) => {
    const key = keyOf(teamId);
    const ttlMs = opts?.ttlMs ?? 5 * 60 * 1000;
    const [data, setData] = useState<TrajectoryMetrics | null>(() => cache.get(key)?.data ?? null);
    const [loading, setLoading] = useState<boolean>(() => !teamId || !cache.has(key));
    const [error, setError] = useState<string | null>(null);

    const abortRef = useRef<AbortController | null>(null);
    const { manifests, fetchManifests } = usePluginStore();

    useEffect(() => {
        if(Object.keys(manifests).length === 0){
            fetchManifests();
        }
    }, [manifests, fetchManifests]);

    const fetchData = async () => {
        try{
            const payload = await fetchOnce(teamId);
            if(abortRef.current?.signal.aborted) return;

            cache.set(key, { data: payload, fetchedAt: Date.now() });
            setData(payload);
            setError(null);
        }catch(err: any){
            const isCanceled =
                    abortRef.current?.signal.aborted ||
                    err?.code === 'ERR_CANCELED' ||
                    err?.name === 'CanceledError' ||
                    String(err?.message || '').toLowerCase() === 'canceled';  
            
            if(isCanceled){
                setLoading(false);
                return;
            }

            const message =
                    err?.response?.data?.message ||
                    err?.message ||
                    'Failed to load metrics';
            setError(message);
        }finally{
            if(!abortRef.current?.signal.aborted){
                setLoading(false);
            }
        }
    };

    useEffect(() => {
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
        if(!data) return [];
        const baseLabels = data.weekly.labels || [];

        const staticCards = [
            buildCard(data, 'trajectories', baseLabels, 'Trajectories', '/dashboard/trajectories/list'),
            buildCard(data, 'analysis', baseLabels, 'Analyses', '/dashboard/analysis-configs/list')
        ];

        const dynamicKeys = Object.keys(data.totals).filter((key) => !['trajectories', 'analysis'].includes(key));
        const dynamicCards = dynamicKeys.map((key) => buildCard(data, key, baseLabels, key));

        let allCards = [...staticCards, ...dynamicCards];

        // Sort by rawCount descending to get top 3
        allCards.sort((a, b) => b.rawCount - a.rawCount);

        // Take top 3
        allCards = allCards.slice(0, 3);

        console.log('x')
        // If we have less than 3 cards, try to fill with available plugins
        if(allCards.length < 3 && Object.keys(manifests).length > 0){
            for(const [pluginId, manifest] of Object.entries(manifests)){
                if(allCards.length >= 3) break;
                if(!manifest.listing) continue;

                // Listings with aggregators.count === true
                const listings = Object.values(manifest.listing).filter((listing) => {
                    return listing.aggregators?.count === true;
                });

                if(listings.length === 0) continue;

                // Use arbitrarily the first listing
                const fallbackCard = {
                    key: `plugin-${pluginId}` as MetricKey,
                    name: listings[0].aggregators.displayName,
                    count: '0',
                    listingUrl: undefined,
                    rawCount: 0,
                    lastMonthStatus: 0,
                    series: Array(12).fill(0),
                    labels: baseLabels,
                    yDomain: { min: 0, max: 1 }
                };

                allCards.push(fallbackCard);
            }
        }
        
        // Sort by rawCount ascending so the one with max count is last
        allCards.sort((a, b) => a.rawCount - b.rawCount);

        return allCards;
    }, [data, manifests, trajectoryId]);

    return { loading, error, data, cards };
};

export default useDashboardMetrics;
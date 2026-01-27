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

export interface MetricCard {
    key: MetricKey;
    name: string;
    listingUrl?: string;
    pluginName?: string;
    count: string;
    rawCount: number;
    lastMonthStatus: number;
    series: number[];
    labels: string[];
    yDomain: { min: number; max: number };
}

export class DashboardMetricsService {
    buildCards(data: TrajectoryMetrics, rotationIndex: number): MetricCard[] {
        const baseLabels = data.weekly.labels || [];

        const staticCards = [
            this.buildCard(data, 'trajectories', baseLabels, 'Trajectories', '/dashboard/trajectories/list'),
            this.buildCard(data, 'analysis', baseLabels, 'Analyses', '/dashboard/analysis-configs/list')
        ];

        const dynamicKeys = Object.keys(data.totals).filter((k) => !['trajectories', 'analysis'].includes(k));
        let dynamicCard: MetricCard | null = null;

        if (dynamicKeys.length > 0) {
            const index = rotationIndex % dynamicKeys.length;
            const key = dynamicKeys[index];
            dynamicCard = this.buildCard(data, key, baseLabels, key);
        }

        return dynamicCard ? [...staticCards, dynamicCard] : staticCards;
    }

    private buildCard(
        data: TrajectoryMetrics,
        metricKey: string,
        baseLabels: string[],
        fallbackName: string,
        fallbackUrl?: string
    ): MetricCard {
        const meta = data.meta?.[metricKey];
        const name = meta?.displayName ?? fallbackName;
        const listingUrl = meta?.listingUrl ?? fallbackUrl;
        const pluginName = meta?.pluginName;

        const rawSeries = this.toNumericArray((data.weekly as any)[metricKey] || []);
        const padded = this.padSeries(baseLabels, rawSeries, 12);
        const rawCount = Number((data.totals as any)[metricKey]) || 0;

        return {
            key: metricKey as MetricKey,
            name,
            listingUrl,
            pluginName,
            count: this.abbreviate(rawCount),
            rawCount,
            lastMonthStatus: Number((data.lastMonth as any)[metricKey]) || 0,
            series: padded.series,
            labels: padded.labels,
            yDomain: this.withPaddingDomain(padded.series)
        };
    }

    private toNumericArray(arr: unknown[]): number[] {
        return (arr || []).map((v) => Number(v) || 0);
    }

    private abbreviate(n: number): string {
        const abs = Math.abs(n);
        if (abs >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 ? 1 : 0)}b`;
        if (abs >= 1e6) return `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}m`;
        if (abs >= 1e3) return `${(n / 1e3).toFixed(n % 1e3 ? 1 : 0)}k`;
        return `${n}`;
    }

    private withPaddingDomain(values: number[]): { min: number; max: number } {
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
    }

    private padSeries(baseLabels: string[], series: number[], desired = 12): { labels: string[]; series: number[] } {
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
    }
}

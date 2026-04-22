import { Service } from '@/core/decorators/service';

export interface ResultCacheMetricsSnapshot {
    hits: number;
    misses: number;
    stores: number;
    storeFailures: number;
    readFailures: number;
    hitRate: number;
}

@Service('resultCacheMetrics')
export class ResultCacheMetrics {
    private hits = 0;
    private misses = 0;
    private stores = 0;
    private storeFailures = 0;
    private readFailures = 0;

    recordHit(): void {
        this.hits += 1;
    }

    recordMiss(): void {
        this.misses += 1;
    }

    recordStore(): void {
        this.stores += 1;
    }

    recordStoreFailure(): void {
        this.storeFailures += 1;
    }

    recordReadFailure(): void {
        this.readFailures += 1;
    }

    snapshot(): ResultCacheMetricsSnapshot {
        const lookups = this.hits + this.misses;
        const hitRate = lookups === 0 ? 0 : this.hits / lookups;
        return {
            hits: this.hits,
            misses: this.misses,
            stores: this.stores,
            storeFailures: this.storeFailures,
            readFailures: this.readFailures,
            hitRate
        };
    }

    renderPrometheus(): string {
        const { hits, misses, stores, storeFailures, readFailures, hitRate } = this.snapshot();
        return [
            '# HELP volt_plugin_result_cache_hits_total Plugin result cache hits',
            '# TYPE volt_plugin_result_cache_hits_total counter',
            `volt_plugin_result_cache_hits_total ${hits}`,
            '# HELP volt_plugin_result_cache_misses_total Plugin result cache misses',
            '# TYPE volt_plugin_result_cache_misses_total counter',
            `volt_plugin_result_cache_misses_total ${misses}`,
            '# HELP volt_plugin_result_cache_stores_total Plugin result cache stores',
            '# TYPE volt_plugin_result_cache_stores_total counter',
            `volt_plugin_result_cache_stores_total ${stores}`,
            '# HELP volt_plugin_result_cache_store_failures_total Plugin result cache store failures',
            '# TYPE volt_plugin_result_cache_store_failures_total counter',
            `volt_plugin_result_cache_store_failures_total ${storeFailures}`,
            '# HELP volt_plugin_result_cache_read_failures_total Plugin result cache read failures',
            '# TYPE volt_plugin_result_cache_read_failures_total counter',
            `volt_plugin_result_cache_read_failures_total ${readFailures}`,
            '# HELP volt_plugin_result_cache_hit_rate Plugin result cache hit rate',
            '# TYPE volt_plugin_result_cache_hit_rate gauge',
            `volt_plugin_result_cache_hit_rate ${hitRate.toFixed(4)}`,
            ''
        ].join('\n');
    }
}

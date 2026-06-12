/**
 * Neutral, cross-module team-metrics snapshot type.
 *
 * Structural mirror of the trajectory module's
 * `@modules/trajectory/domain/contracts/trajectory/TeamMetrics`
 * (`TeamMetricsSnapshot`), hoisted into the neutral contracts layer for the
 * detachable-modules migration so consumers (dashboard) can type team-metrics
 * results without importing `@modules/trajectory`. The owner module's shape is
 * byte-identical, so its concrete service output is assignable here.
 *
 * Pure type — no runtime footprint, no `@modules/*` import.
 */
export interface TeamMetricsSnapshot {
    totals: Record<string, number>;
    lastMonth: Record<string, number>;
    weekly: {
        labels: string[];
        [series: string]: number[] | string[];
    };
}

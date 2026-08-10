/**
 * Recharts takes its colours as strings, so these stay `var()` references rather than
 * classes. They name HeroUI's own tokens: the bravais aliases they used to read
 * (`--color-brand-primary`, `--status-success`, `--status-warning`) survive only in
 * the temporary compatibility shim in `index.css`, which is deleted along with the
 * last component stylesheet (spec §5b.1). `--accent` is VOLT's accent, which under
 * this identity is the foreground.
 */
export const CHART_COLORS = {
    read: 'var(--accent)',
    write: 'var(--success)',
    iops: 'var(--warning)'
};

/**
 * Chrome shared between the activity drawer and the panel it renders.
 *
 * `.dashboard-activity-chart-surface` was reached from both files — the drawer used
 * it for the loading placeholder so the panel does not change height when the chart
 * arrives — so it lives here rather than being written twice. `--radius-lg` is 16px,
 * i.e. HeroUI's `rounded-2xl` (spec §3b), and `--color-border` is `--border`.
 */
export const CHART_SURFACE = 'min-h-0 flex-1 overflow-hidden rounded-2xl border border-border';

/** `.dashboard-card-state`. */
export const CARD_STATE = 'min-h-full';
